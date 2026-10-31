import assert from "node:assert/strict";

// Executable contract for a future creator-facing recovery handler.
// No MongoDB connection, production writes, or server launch.
// The module is intentionally absent at verifier-first stage.
const { createMovieMentorCreatorStateRecoveryHandler } = await import("../ai/MovieMentorCreatorStateRecoveryHandler.js");

const original = Object.freeze({
  projectId: "project-alpha", revision: 7, creatorStateGeneration: 7,
  creatorConfirmedContext: [{ key: "project", value: { id: "project-alpha" } }],
  projectJourney: { projectId: "project-alpha", status: "completed" },
  memoryContext: { conversations: [{ text: "private creator story" }] },
  responseBlueprint: null, communicationPlan: null,
  creatorStateFingerprint: "fingerprint-seven",
  revisionAuthorityReference: "revision-seven",
  creatorAuthorityReference: "creator-seven",
  snapshotReference: "snapshot-seven",
  principalId: "SHOULD_NEVER_BE_EXPOSED",
  internalSecret: "NEVER_EXPOSE"
});
let readCount = 0;
let owner = "owner-alpha";
let current = original;
const requestAuthority = {
  async authorize({ request, projectId }) {
    if (!request?.token) throw Object.assign(new Error("Missing authentication"), { code: "AUTH_REQUIRED" });
    if (request.token !== owner || projectId !== "project-alpha") throw Object.assign(new Error("Project not authorized"), { code: "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED" });
    return { authorized: true, projectId, principalId: request.token };
  }
};
const readAuthoritativeState = async ({ projectId }) => {
  readCount++;
  assert.equal(projectId, "project-alpha");
  return current;
};
const recover = createMovieMentorCreatorStateRecoveryHandler({ requestAuthority, readAuthoritativeState });
async function denied(input, code) {
  await assert.rejects(() => recover(input), error => error?.code === code);
}
await denied({ request: {}, projectId: "project-alpha" }, "AUTH_REQUIRED");
await denied({ request: { token: "other-owner" }, projectId: "project-alpha" }, "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED");
await denied({ request: { token: "owner-alpha" }, projectId: "project-beta" }, "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED");
assert.equal(readCount, 0, "Unauthorized requests must not read private state");
const response = await recover({ request: { token: "owner-alpha" }, projectId: "project-alpha" });
assert.equal(response.projectId, original.projectId);
assert.equal(response.revision, 7);
assert.deepEqual(response.projectJourney, original.projectJourney);
assert.deepEqual(response.creatorConfirmedContext, original.creatorConfirmedContext);
assert.deepEqual(response.memoryContext, original.memoryContext);
for (const key of ["principalId", "internalSecret"]) assert.equal(Object.hasOwn(response, key), false, `Must not expose ${key}`);
assert.equal(readCount, 1);
current = null;
await denied({ request: { token: "owner-alpha" }, projectId: "project-alpha" }, "MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND");
current = { ...original, projectId: "project-beta" };
await denied({ request: { token: "owner-alpha" }, projectId: "project-alpha" }, "MOVIE_MENTOR_CREATOR_STATE_IDENTITY_CONFLICT");
current = { ...original, revision: -1 };
await denied({ request: { token: "owner-alpha" }, projectId: "project-alpha" }, "MOVIE_MENTOR_CREATOR_STATE_REVISION_INVALID");
current = original;
const priorOwner = owner;
owner = "other-owner";
await denied({ request: { token: priorOwner }, projectId: "project-alpha" }, "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED");
console.log("Creator-state recovery authorization, revision and safe-exposure contracts passed.");
