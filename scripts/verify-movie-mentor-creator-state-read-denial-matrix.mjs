import assert from "node:assert/strict";
import { createMovieMentorCreatorStateReadAuthority } from "../ai/MovieMentorCreatorStateReadAuthority.js";

// Isolated negative contract: never infer authorization from a projectId,
// a successful login alone, or a structurally plausible storage response.
const owner = { authenticated: true, principalId: "owner-a" };
const baseState = { projectId: "project-a", revision: 3, creatorStateGeneration: 2 };
for (const scenario of [
  { name: "ownership explicitly denied", ownership: { authorized: false, projectId: "project-a" } },
  { name: "ownership bound to different project", ownership: { authorized: true, projectId: "project-b", ownershipRef: "ref", ownershipRevision: 1 } },
  { name: "missing ownership reference", ownership: { authorized: true, projectId: "project-a", ownershipRevision: 1 } },
  { name: "invalid ownership revision", ownership: { authorized: true, projectId: "project-a", ownershipRef: "ref", ownershipRevision: 0 } },
]) {
  let reads = 0;
  const authority = createMovieMentorCreatorStateReadAuthority({
    ownershipAuthority: { authorizeProject: async () => scenario.ownership },
    readCreatorState: async () => { reads++; return baseState; },
  });
  const result = await authority.read({ principal: owner, projectId: "project-a" });
  assert.equal(result.authorized, false, "RED: " + scenario.name);
  assert.equal(reads, 0, "RED: " + scenario.name + " must never reach the store");
}
for (const scenario of [
  { name: "wrong project", state: { ...baseState, projectId: "project-b" } },
  { name: "zero revision", state: { ...baseState, revision: 0 } },
  { name: "zero generation", state: { ...baseState, creatorStateGeneration: 0 } },
]) {
  const authority = createMovieMentorCreatorStateReadAuthority({
    ownershipAuthority: { authorizeProject: async () => ({ authorized: true, projectId: "project-a", ownershipRef: "ref", ownershipRevision: 1 }) },
    readCreatorState: async () => scenario.state,
  });
  await assert.rejects(authority.read({ principal: owner, projectId: "project-a" }),
    error => error?.code === "MOVIE_MENTOR_CREATOR_READ_INVALID_STATE",
    "RED: " + scenario.name + " must be rejected");
}
console.log("GREEN: foreign/malformed ownership evidence never reaches store; wrong-project or invalid durable state is rejected.");
console.log("LIMITATION: isolated mocks only; physical HTTP, JWT, Mongo and ownership-revocation race not certified.");
