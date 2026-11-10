import assert from "node:assert/strict";
import mongoose from "mongoose";
import { readAuthoritativeTurnSource } from "../ai/MovieMentorCreatorStateStore.js";
import { createMovieMentorProjectOwnershipAuthority, MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN, MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA } from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorCreatorStateReadAuthority } from "../ai/MovieMentorCreatorStateReadAuthority.js";

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
    const ownership = db.collection("movie_mentor_project_ownership");
    await ownership.createIndex({ projectId: 1 }, { unique: true });
    await ownership.createIndex({ establishmentAuthorityId: 1 }, { unique: true });
    await ownership.insertOne({
      domain: MOVIE_MENTOR_PROJECT_OWNERSHIP_DOMAIN,
      schema: MOVIE_MENTOR_PROJECT_OWNERSHIP_SCHEMA,
      projectId, ownerPrincipalId: "physical-owner",
      ownershipRevision: 1, ownershipReference: "physical-owner-reference",
      establishmentAuthorityId: "physical-establishment",
      establishmentSource: "native-project-creation", status: "active",
      establishedAt: new Date(),
    });
    const ownershipBefore = await ownership.findOne({ projectId });
    const authority = createMovieMentorCreatorStateReadAuthority({
      ownershipAuthority: createMovieMentorProjectOwnershipAuthority(),
      readCreatorState: readAuthoritativeTurnSource,
    });
    const owner = await authority.read({ principal: { authenticated: true, principalId: "physical-owner" }, projectId });
    assert.equal(owner.authorized, true, "RED: durable owner must recover");
    assert.equal(owner.state.revision, 1);
    const foreign = await authority.read({ principal: { authenticated: true, principalId: "physical-foreigner" }, projectId });
    assert.equal(foreign.authorized, false, "RED: foreign principal must not recover");
    assert.deepEqual(await ownership.findOne({ projectId }), ownershipBefore, "RED: ownership mutated during read");
    assert.deepEqual(await states.findOne({ projectId }), before, "RED: creator state mutated during owner-bound read");
    console.log("GREEN PHYSICAL MONGO: actual durable ownership allows owner, denies foreign principal, leaves both records immutable");
    throw new Error("RED PHYSICAL RECOVERY UNIMPLEMENTED: actual RS256 and loopback HTTP still required");
  } finally {
    await mongoose.disconnect();
  }
}
