import assert from "node:assert/strict";
import mongoose from "mongoose";
import { readAuthoritativeTurnSource } from "../ai/MovieMentorCreatorStateStore.js";

// Physical Mongo stage only. Test fixtures are isolated, never production.
// This stage must not claim signed HTTP or owner-bound recovery certification.
export async function runMovieMentorPhysicalCreatorRecoveryCourt() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\//.test(uri)) {
    throw new Error("RED PHYSICAL PREFLIGHT: isolated loopback Mongo URI required");
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, "rs0", "RED: actual rs0 required");
    assert.equal(hello.isWritablePrimary, true, "RED: writable PRIMARY required");
    console.log("GREEN PHYSICAL MONGO: loopback replica-set PRIMARY verified");
    const db = mongoose.connection.db;
    const states = db.collection("movie_mentor_creator_state");
    await states.createIndex({ projectId: 1 }, {
      unique: true, partialFilterExpression: { projectId: { $type: "string" } },
    });
    const projectId = "physical-recovery-isolated-project";
    await states.insertOne({
      projectId, revision: 1, creatorStateGeneration: 1,
      revisionAuthorityReference: "isolated-revision",
      creatorStateFingerprint: "isolated-fingerprint",
      creatorAuthorityReference: "isolated-creator-authority",
      snapshotReference: "isolated-snapshot",
      creatorConfirmedContext: [],
      capturedAt: new Date(),
    });
    const before = await states.findOne({ projectId });
    const state = await readAuthoritativeTurnSource({ projectId });
    assert.equal(state.projectId, projectId);
    assert.equal(state.revision, 1);
    assert.equal(state.creatorStateGeneration, 1);
    const after = await states.findOne({ projectId });
    assert.deepEqual(after, before, "RED: authoritative read mutated durable state");
    console.log("GREEN PHYSICAL MONGO: real indexed authoritative creator-state read and immutability");
    throw new Error("RED PHYSICAL RECOVERY UNIMPLEMENTED: actual RS256, HTTP and durable owner-bound recovery still required");
  } finally {
    await mongoose.disconnect();
  }
}
