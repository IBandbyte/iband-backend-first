import assert from "node:assert/strict";
import { createMovieMentorCreatorStateReadAuthority } from "../ai/MovieMentorCreatorStateReadAuthority.js";

// A previously authorized owner loses durable ownership while the store read
// is in flight. Returning the snapshot would expose another owner's project.
let resolveRead;
let startedRead;
const readStarted = new Promise(resolve => { startedRead = resolve; });
const blockedRead = new Promise(resolve => { resolveRead = resolve; });
let ownershipRevision = 7;
let ownershipChecks = 0;
const authority = createMovieMentorCreatorStateReadAuthority({
  ownershipAuthority: {
    async authorizeProject({ principal, projectId }) {
      ownershipChecks++;
      return {
        authorized: principal?.principalId === "owner-a" && ownershipRevision === 7,
        projectId, ownershipRef: ownershipRevision === 7 ? "ownership-before" : "ownership-after",
        ownershipRevision,
      };
    },
  },
  readCreatorState: async () => {
    startedRead();
    await blockedRead;
    return { projectId: "project-a", revision: 5, creatorStateGeneration: 6 };
  },
});
const pending = authority.read({ principal: { authenticated: true, principalId: "owner-a" }, projectId: "project-a" });
await readStarted;
ownershipRevision = 8;
resolveRead();
const result = await pending;
assert.equal(result.authorized, false, "RED: revoked ownership must deny the in-flight read before state exposure");
assert.ok(ownershipChecks >= 2, "RED: ownership must be revalidated after durable state read");
assert.equal(result.state, undefined, "RED: revoked owner must not receive creator state");
console.log("GREEN: in-flight owner revocation denies recovery response without exposing durable creator state.");
console.log("LIMITATION: deterministic isolated race, not a physical Mongo or HTTP revocation court.");
