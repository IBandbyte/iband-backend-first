import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMongoCreatorStateAtomicAccept } from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Isolated physical characterization only. A revision update here is an adversarial
// test operation, NOT a production ownership-transfer/revocation API.
const uri = process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri), "Disposable localhost MongoDB required");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const ownerships = db.collection("movie_mentor_project_ownership");
const states = db.collection("isolated_durable_revision_contention_states");
const operations = db.collection("isolated_durable_revision_contention_ops");
const principalId = "owner";
const proofFor = projectId => ({
  domain: "iband.movie-mentor.creator-state-mutation-authority", schema: 1, principalId, projectId,
  assertCurrentMutation: async target => ({
    domain: "iband.movie-mentor.creator-state-mutation-proof", schema: 1,
    authorized: true, currentOwnershipVerified: true, principalId, projectId,
    ownershipRef: "ownership-v1", ownershipRevision: 1, ...target,
  }),
});
const envelopeFor = projectId => ({
  projectId, principalId, operationId: "op-1", source: "creator-memory",
  expectedRevision: 0, requestDigest: "revision-contention-digest",
});
const stateFor = projectId => ({
  projectId, revision: 1, creatorStateGeneration: 1,
  creatorStateFingerprint: "revision-contention-fingerprint",
  revisionAuthorityReference: "revision-authority",
  creatorAuthorityReference: "creator-authority",
  snapshotReference: "snapshot",
  capturedAt: new Date("2026-11-07T00:00:00.000Z"),
});
const acceptFor = (projectId, instrumentedStates) => createMongoCreatorStateAtomicAccept({
  client: mongoose.connection.getClient(), states: instrumentedStates, operations, ownerships,
})({
  envelope: envelopeFor(projectId), proposedState: stateFor(projectId),
  creatorStateMutationAuthority: proofFor(projectId),
});
const revisionChange = projectId => ownerships.updateOne(
  { projectId, ownershipRevision: 1, status: "active" },
  { $inc: { ownershipRevision: 1 } },
  { maxTimeMS: 8000 },
);
try {
  await states.createIndex({ projectId: 1 }, { unique: true });
  await operations.createIndex({ projectId: 1, principalId: 1, operationId: 1 }, { unique: true });
  await ownerships.createIndex({ projectId: 1 }, { unique: true });

  // Court A: a real durable revision change after the transactional read,
  // but before the adapter attempts its ownership fence.
  const before = "durable-revision-before-fence";
  await ownerships.insertOne({
    projectId: before, ownerPrincipalId: principalId,
    ownershipReference: "ownership-v1", ownershipRevision: 1, status: "active",
  });
  let changedBeforeFence = false;
  const beforeStates = {
    indexes: (...a) => states.indexes(...a),
    findOne: async (...a) => {
      const value = await states.findOne(...a);
      if (!changedBeforeFence) {
        changedBeforeFence = true;
        const changed = await revisionChange(before);
        assert.equal(changed.modifiedCount, 1, "Physical competing revision must change");
      }
      return value;
    },
    replaceOne: (...a) => states.replaceOne(...a),
  };
  let denial;
  try {
    await acceptFor(before, beforeStates);
  } catch (e) { denial = e; }
  assert.equal(changedBeforeFence, true);
  assert.equal(denial?.code, "MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED");
  assert.equal((await ownerships.findOne({ projectId: before })).ownershipRevision, 2);
  assert.equal(await states.countDocuments({ projectId: before }), 0);
  assert.equal(await operations.countDocuments({ projectId: before }), 0);
  console.log("GREEN: durable revision changed before fence; explicit denial; zero creator-state and operation writes.");

  // Court B: trigger an actual competing durable update at the final state
  // write boundary, after the transaction has already written its fence.
  // Never wait inside the transaction for the competing writer: that would
  // manufacture a deadlock rather than test MongoDB serialization.
  const after = "durable-revision-after-fence";
  await ownerships.insertOne({
    projectId: after, ownerPrincipalId: principalId,
    ownershipReference: "ownership-v1", ownershipRevision: 1, status: "active",
  });
  let competingPromise = null;
  const afterStates = {
    indexes: (...a) => states.indexes(...a),
    findOne: (...a) => states.findOne(...a),
    replaceOne: (...a) => {
      if (!competingPromise) competingPromise = revisionChange(after);
      return states.replaceOne(...a);
    },
  };
  let outcome, acceptError;
  try { outcome = await acceptFor(after, afterStates); }
  catch (e) { acceptError = e; }
  assert.ok(competingPromise, "Competing revision must be started after fence");
  let competingResult, competingError;
  try { competingResult = await competingPromise; }
  catch (e) { competingError = e; }
  const owner = await ownerships.findOne({ projectId: after });
  const stateCount = await states.countDocuments({ projectId: after });
  const operationCount = await operations.countDocuments({ projectId: after });
  assert.ok([1, 2].includes(owner.ownershipRevision), "Ownership revision must remain valid");
  assert.equal(stateCount, operationCount, "State and operation must commit atomically");
  assert.ok(stateCount === 0 || stateCount === 1, "At most one accepted creator-state mutation");
  if (outcome?.kind === "accepted") {
    assert.equal(stateCount, 1);
    assert.equal(operationCount, 1);
  } else {
    assert.equal(stateCount, 0);
    assert.equal(operationCount, 0);
    assert.ok(acceptError, "Non-acceptance must carry an explicit failure");
  }
  if (competingResult?.modifiedCount === 1) assert.equal(owner.ownershipRevision, 2);
  if (owner.ownershipRevision === 1) assert.ok(competingError || competingResult?.modifiedCount === 0);
  console.log("GREEN: post-fence contention physically observed; atomic creator-state and operation outcome; ownership revision consistent.", {
    accepted: outcome?.kind === "accepted",
    acceptanceError: acceptError?.code || acceptError?.name || null,
    competingModified: competingResult?.modifiedCount ?? null,
    competingError: competingError?.code || competingError?.name || null,
    finalOwnershipRevision: owner.ownershipRevision, stateCount, operationCount,
  });
} finally {
  await mongoose.disconnect();
}
