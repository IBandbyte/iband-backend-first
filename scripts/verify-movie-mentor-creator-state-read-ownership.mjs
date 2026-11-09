import assert from "node:assert/strict";
import { createMovieMentorCreatorStateReadAuthority } from "../ai/MovieMentorCreatorStateReadAuthority.js";

// VERIFIER FIRST: no route is mounted and no production database is touched.
// Independent ownership authorization must precede any creator-state read.
const calls = [];
const state = { projectId: "project-a", revision: 4, creatorStateGeneration: 7, creatorConfirmedContext: [] };
const ownershipAuthority = {
  async authorizeProject({ principal, projectId }) {
    calls.push("ownership:" + projectId);
    return { authorized: principal?.principalId === "owner-a" && projectId === "project-a", projectId,
      ownershipRef: "durable-ownership", ownershipRevision: 2 };
  },
};
const readCreatorState = async ({ projectId }) => {
  calls.push("read:" + projectId);
  return { ...state, projectId };
};
const authority = createMovieMentorCreatorStateReadAuthority({ ownershipAuthority, readCreatorState });
const unauthenticated = await authority.read({ principal: { authenticated: false, principalId: "owner-a" }, projectId: "project-a" });
assert.equal(unauthenticated.authorized, false);
assert.deepEqual(calls, [], "RED: unauthenticated request must not reach ownership registry or durable store");
const foreign = await authority.read({ principal: { authenticated: true, principalId: "intruder" }, projectId: "project-a" });
assert.equal(foreign.authorized, false);
assert.deepEqual(calls, ["ownership:project-a"], "RED: unauthorized principal must never read creator state");
const owned = await authority.read({ principal: { authenticated: true, principalId: "owner-a" }, projectId: "project-a" });
assert.equal(owned.authorized, true);
assert.equal(owned.state.projectId, "project-a");
assert.equal(owned.state.revision, 4);
assert.equal(owned.state.creatorStateGeneration, 7);
assert.deepEqual(calls, ["ownership:project-a", "ownership:project-a", "read:project-a", "ownership:project-a"], "RED: successful read must revalidate durable ownership after reading state");
console.log("GREEN: authentication, ownership and durable creator-state read occur in order; unauthorized reads denied.");
console.log("LIMITATION: isolated mock authority; no HTTP route, real Clerk credential, physical Mongo read or production exposure certified.");
