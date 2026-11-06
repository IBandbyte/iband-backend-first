import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMongoCreatorStateAtomicAccept } from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Opposite ordering from the earlier race court: creator-state transaction
// obtains its durable ownership fence before a competing independent write.
// The competitor must not invalidate an already committed acceptance.
const uri = process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri), "Isolated localhost Mongo URI required.");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
try {
  const db = mongoose.connection.db;
  const states = db.collection("isolated_fence_first_state");
  const operations = db.collection("isolated_fence_first_operations");
  const ownerships = db.collection("movie_mentor_project_ownership");
  await states.createIndex({ projectId: 1 }, { unique: true });
  await operations.createIndex({ projectId: 1, principalId: 1, operationId: 1 }, { unique: true });
  await ownerships.createIndex({ projectId: 1 }, { unique: true });
  await ownerships.insertOne({ projectId: "fence-first", ownerPrincipalId: "owner", ownershipReference: "ownership-v1", ownershipRevision: 1, status: "active" });
  let fenceAcquired = false;
  let competingWrite = null;
  const instrumentedOwnerships = {
    collectionName: ownerships.collectionName,
    updateOne: async (...args) => {
      const fenced = await ownerships.updateOne(...args);
      assert.equal(fenced.matchedCount, 1, "Creator-state transaction must acquire the durable fence.");
      fenceAcquired = true;
      // A separate MongoDB operation now attempts to revise ownership while
      // the creator-state transaction still holds its uncommitted fence.
      competingWrite = ownerships.updateOne(
        { projectId: "fence-first", ownershipRevision: 1 },
        { $set: { ownershipRevision: 2 } },
        { maxTimeMS: 10000 }
      );
      return fenced;
    },
  };
  const authority = {
    domain: "iband.movie-mentor.creator-state-mutation-authority",
    schema: 1, principalId: "owner", projectId: "fence-first",
    assertCurrentMutation: async target => ({
      domain: "iband.movie-mentor.creator-state-mutation-proof",
      schema: 1, authorized: true, currentOwnershipVerified: true,
      principalId: "owner", projectId: "fence-first",
      ownershipRef: "ownership-v1", ownershipRevision: 1, ...target,
    }),
  };
  const accept = createMongoCreatorStateAtomicAccept({
    client: mongoose.connection.getClient(), states, operations, ownerships: instrumentedOwnerships,
  });
  const result = await accept({
    envelope: { projectId: "fence-first", principalId: "owner", operationId: "fence-first-op", source: "creator-memory", expectedRevision: 0, requestDigest: "fence-first-digest" },
    proposedState: { projectId: "fence-first", revision: 1, creatorStateGeneration: 1, creatorStateFingerprint: "fence-first-fingerprint", revisionAuthorityReference: "fence-first-revision", creatorAuthorityReference: "fence-first-authority", snapshotReference: "fence-first-snapshot", capturedAt: new Date("2026-11-06T00:00:00.000Z") },
    creatorStateMutationAuthority: authority,
  });
  assert.equal(fenceAcquired, true, "Durable ownership fence must precede competing write.");
  assert.equal(result?.kind, "accepted", "Transaction with acquired ownership fence must commit.");
  assert.ok(competingWrite, "Competing durable ownership write must have been started.");
  const revision = await competingWrite;
  assert.equal(revision.matchedCount, 1, "Competing ownership revision should commit after fence release.");
  assert.equal((await ownerships.findOne({ projectId: "fence-first" })).ownershipRevision, 2);
  assert.equal(await states.countDocuments({ projectId: "fence-first", revision: 1 }), 1);
  assert.equal(await operations.countDocuments({ projectId: "fence-first", operationId: "fence-first-op" }), 1);
  console.log("GREEN: creator-state transaction fenced first and committed exactly once; competing ownership revision committed afterward.");
} finally {
  await mongoose.disconnect();
}
