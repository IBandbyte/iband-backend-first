import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMongoCreatorStateAtomicAccept } from "../ai/MovieMentorCreatorStateMongoOperationAdapter.js";

// Isolated adversarial race: a durable ownership revision changes after the
// transactional creator-state read and before the ownership fence write.
// This characterizes rollback, not production support for ownership transfer.
const uri = process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(uri), "Isolated localhost Mongo URI required.");
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
try {
  const db = mongoose.connection.db;
  const states = db.collection("isolated_durable_revocation_state");
  const operations = db.collection("isolated_durable_revocation_operations");
  const ownerships = db.collection("movie_mentor_project_ownership");
  await states.createIndex({ projectId: 1 }, { unique: true });
  await operations.createIndex({ projectId: 1, principalId: 1, operationId: 1 }, { unique: true });
  await ownerships.createIndex({ projectId: 1 }, { unique: true });
  await ownerships.insertOne({ projectId: "race-project", ownerPrincipalId: "owner", ownershipReference: "ownership-v1", ownershipRevision: 1, status: "active" });
  let changed = false;
  const instrumentedStates = {
    indexes: (...args) => states.indexes(...args),
    findOne: async (...args) => {
      const result = await states.findOne(...args);
      if (!changed) {
        changed = true;
        const update = await ownerships.updateOne(
          { projectId: "race-project", ownershipRevision: 1 },
          { $set: { ownershipRevision: 2 } }
        );
        assert.equal(update.matchedCount, 1, "Adversarial durable revocation must actually commit.");
      }
      return result;
    },
    replaceOne: (...args) => states.replaceOne(...args),
  };
  const authority = {
    domain: "iband.movie-mentor.creator-state-mutation-authority",
    schema: 1, principalId: "owner", projectId: "race-project",
    assertCurrentMutation: async target => ({
      domain: "iband.movie-mentor.creator-state-mutation-proof",
      schema: 1, authorized: true, currentOwnershipVerified: true,
      principalId: "owner", projectId: "race-project",
      ownershipRef: "ownership-v1", ownershipRevision: 1, ...target,
    }),
  };
  const accept = createMongoCreatorStateAtomicAccept({
    client: mongoose.connection.getClient(), states: instrumentedStates, operations, ownerships,
  });
  let outcome, failure;
  try {
    outcome = await accept({
      envelope: { projectId: "race-project", principalId: "owner", operationId: "race-op", source: "creator-memory", expectedRevision: 0, requestDigest: "race-digest" },
      proposedState: { projectId: "race-project", revision: 1, creatorStateGeneration: 1, creatorStateFingerprint: "race-fingerprint", revisionAuthorityReference: "race-revision", creatorAuthorityReference: "race-authority", snapshotReference: "race-snapshot", capturedAt: new Date("2026-11-06T00:00:00.000Z") },
      creatorStateMutationAuthority: authority,
    });
  } catch (error) { failure = error; }
  assert.equal(changed, true, "Durable ownership revision must have changed during the attempted transaction.");
  assert.notEqual(outcome?.kind, "accepted", "Stale ownership must not be accepted.");
  assert.ok(failure, "Stale ownership must fail closed.");
  assert.equal((await ownerships.findOne({ projectId: "race-project" })).ownershipRevision, 2);
  assert.equal(await states.countDocuments({ projectId: "race-project" }), 0, "No partial creator-state write.");
  assert.equal(await operations.countDocuments({ projectId: "race-project" }), 0, "No partial operation claim.");
  console.log("GREEN: durable ownership revision changed during transactional read; stale creator-state acceptance denied without partial writes.", { code: failure.code ?? null });
} finally {
  await mongoose.disconnect();
}
