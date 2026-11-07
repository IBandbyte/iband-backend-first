import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { createMongoCreatorStateAtomicAccept } from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Dedicated physical overlap court. A competing revision mutation is a
// test-only adversarial operation; production ownership transfer is disabled.
const uri = process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(localhost|127\.0\.0\.1):/.test(uri), "Isolated localhost Mongo required");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const competitor = new MongoClient(uri, { monitorCommands: true, serverSelectionTimeoutMS: 5000 });
try {
  await competitor.connect();
  const db = mongoose.connection.db;
  const states = db.collection("isolated_postfence_overlap_states");
  const operations = db.collection("isolated_postfence_overlap_ops");
  const ownerships = db.collection("movie_mentor_project_ownership");
  const projectId = "physical-overlap-owner";
  await states.createIndex({ projectId: 1 }, { unique: true });
  await operations.createIndex({ projectId: 1, principalId: 1, operationId: 1 }, { unique: true });
  await ownerships.createIndex({ projectId: 1 }, { unique: true });
  await ownerships.insertOne({ projectId, ownerPrincipalId: "owner", ownershipReference: "ownership-v1", ownershipRevision: 1, status: "active" });

  let signalAtBoundary;
  const atBoundary = new Promise(resolve => { signalAtBoundary = resolve; });
  let releaseBoundary;
  const boundaryRelease = new Promise(resolve => { releaseBoundary = resolve; });
  let fenceCompleted = false;
  const instrumentedOwnerships = {
    collectionName: ownerships.collectionName,
    updateOne: async (...args) => {
      const result = await ownerships.updateOne(...args);
      assert.equal(result.matchedCount, 1, "Transactional fence must match");
      fenceCompleted = true;
      return result;
    },
  };
  let paused = false;
  const instrumentedStates = {
    indexes: (...args) => states.indexes(...args),
    findOne: (...args) => states.findOne(...args),
    replaceOne: async (...args) => {
      assert.equal(fenceCompleted, true, "Pause only after physical ownership fence");
      assert.equal(paused, false, "Boundary must be entered once");
      paused = true;
      signalAtBoundary();
      await boundaryRelease;
      return states.replaceOne(...args);
    },
  };
  const proof = {
    domain: "iband.movie-mentor.creator-state-mutation-authority", schema: 1,
    principalId: "owner", projectId,
    assertCurrentMutation: async target => ({
      domain: "iband.movie-mentor.creator-state-mutation-proof", schema: 1,
      authorized: true, currentOwnershipVerified: true,
      principalId: "owner", projectId, ownershipRef: "ownership-v1",
      ownershipRevision: 1, ...target,
    }),
  };
  const accept = createMongoCreatorStateAtomicAccept({
    client: mongoose.connection.getClient(), states: instrumentedStates,
    operations, ownerships: instrumentedOwnerships,
  });
  const acceptance = accept({
    envelope: {
      projectId, principalId: "owner", operationId: "op-overlap",
      source: "creator-memory", expectedRevision: 0, requestDigest: "overlap-digest",
    },
    proposedState: {
      projectId, revision: 1, creatorStateGeneration: 1,
      creatorStateFingerprint: "overlap-fingerprint",
      revisionAuthorityReference: "revision", creatorAuthorityReference: "authority",
      snapshotReference: "snapshot", capturedAt: new Date("2026-11-07T00:00:00Z"),
    },
    creatorStateMutationAuthority: proof,
  });
  // Prevent an unhandled rejection if an unexpected failure occurs before
  // the boundary is reached.
  const acceptanceSettled = acceptance.then(value => ({ value }), error => ({ error }));
  const reached = await Promise.race([
    atBoundary.then(() => true),
    acceptanceSettled.then(() => false),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for physical fence boundary")), 8000)),
  ]);
  assert.equal(reached, true, "Acceptance must reach post-fence boundary");

  let commandStarted = false;
  competitor.on("commandStarted", event => {
    if (event.commandName === "update" && event.command?.update === "movie_mentor_project_ownership") commandStarted = true;
  });
  const rivalCollection = competitor.db(db.databaseName).collection("movie_mentor_project_ownership");
  let rivalDone = false;
  const rival = rivalCollection.updateOne(
    { projectId, ownershipRevision: 1, status: "active" },
    { $inc: { ownershipRevision: 1 } },
    { maxTimeMS: 1200 },
  ).then(value => { rivalDone = true; return { value }; }, error => { rivalDone = true; return { error }; });

  // The creator-state transaction is deliberately still open. A competing
  // write must reach MongoDB and must NOT successfully change ownership.
  let rivalResult;
  try {
    rivalResult = await Promise.race([
      rival,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Competing command did not settle while fence was held")), 6000)),
    ]);
    assert.equal(commandStarted, true, "MongoDB must receive a physical competing update command");
    assert.equal(rivalDone, true);
    assert.ok(rivalResult.error || rivalResult.value?.modifiedCount === 0,
      "Competing ownership revision must not succeed while transactional fence is held");
    assert.equal((await ownerships.findOne({ projectId })).ownershipRevision, 1,
      "No durable revision may advance before fence transaction settles");
  } finally {
    releaseBoundary();
  }

  const accepted = await acceptanceSettled;
  assert.ifError(accepted.error);
  assert.equal(accepted.value?.kind, "accepted");
  assert.equal(await states.countDocuments({ projectId }), 1);
  assert.equal(await operations.countDocuments({ projectId }), 1);
  assert.equal((await ownerships.findOne({ projectId })).ownershipRevision, 1);

  // Once the fence transaction commits, a separate physical revision change
  // can succeed; this confirms the competing operation was not a no-op.
  const afterCommit = await rivalCollection.updateOne(
    { projectId, ownershipRevision: 1, status: "active" },
    { $inc: { ownershipRevision: 1 } },
  );
  assert.equal(afterCommit.modifiedCount, 1);
  assert.equal((await ownerships.findOne({ projectId })).ownershipRevision, 2);
  assert.equal(await states.countDocuments({ projectId }), 1);
  assert.equal(await operations.countDocuments({ projectId }), 1);
  console.log("GREEN: competing Mongo update command reached the server while durable ownership fence was held; no competing revision committed before fence release; creator-state and operation committed atomically; revision advanced only after release.", {
    rivalError: rivalResult.error?.code || rivalResult.error?.codeName || null,
    rivalModifiedCount: rivalResult.value?.modifiedCount ?? null,
  });
} finally {
  await competitor.close();
  await mongoose.disconnect();
}
