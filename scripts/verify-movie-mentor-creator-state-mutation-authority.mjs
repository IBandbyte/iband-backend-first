import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
  createMovieMentorCreatorStateMutationAuthority,
  assertMovieMentorCreatorStateMutationAuthority,
} from "../ai/MovieMentorCreatorStateMutationAuthority.js";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";
import { assertCreatorStateStoreMutationAuthority } from "../ai/MovieMentorCreatorStateStore.js";

console.log("ROUND SEVEN — creator-state mutation current-ownership authority torture");

const initialAuthorization = Object.freeze({
  authorized: true,
  principalId: "creator-1",
  projectId: "project-1",
  ownershipRef: "ownership:project-1",
  ownershipRevision: 1,
  authorizationSource: "durable-ownership",
});
const target = Object.freeze({
  projectId: "project-1",
  source: "creator-memory",
  expectedRevision: 4,
  revision: 5,
  creatorStateGeneration: 3,
  creatorStateFingerprint: "fingerprint-5",
});

let currentCalls = 0;
const currentRequestAuthority = {
  async authorize({ projectId }) {
    currentCalls++;
    assert.equal(projectId, "project-1");
    return initialAuthorization;
  },
};
const capability = createMovieMentorCreatorStateMutationAuthority({ request: { headers: { authorization: "Bearer current" } }, authorization: initialAuthorization, requestAuthority: currentRequestAuthority });
assert.equal(capability.domain, MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN);
assert.equal(capability.projectId, "project-1");
const proof = await assertMovieMentorCreatorStateMutationAuthority({ authority: capability, ...target });
assert.equal(proof.domain, MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN);
assert.equal(proof.currentOwnershipVerified, true);
assert.equal(proof.principalId, "creator-1");
assert.equal(proof.projectId, "project-1");
assert.equal(proof.expectedRevision, 4);
assert.equal(proof.revision, 5);
assert.equal(currentCalls, 1);

await assert.rejects(
  () => assertMovieMentorCreatorStateMutationAuthority({ authority: capability, ...target, projectId: "project-2" }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED" || error.code === "MOVIE_MENTOR_CREATOR_STATE_MUTATION_BINDING_INVALID",
);

const intruderAuthority = createMovieMentorCreatorStateMutationAuthority({
  request: {},
  authorization: initialAuthorization,
  requestAuthority: { async authorize() { return { ...initialAuthorization, principalId: "intruder" }; } },
});
await assert.rejects(
  () => assertMovieMentorCreatorStateMutationAuthority({ authority: intruderAuthority, ...target }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED",
);

const changedOwnership = createMovieMentorCreatorStateMutationAuthority({
  request: {},
  authorization: initialAuthorization,
  requestAuthority: { async authorize() { return { ...initialAuthorization, ownershipRef: "ownership:changed", ownershipRevision: 2 }; } },
});
await assert.rejects(
  () => assertMovieMentorCreatorStateMutationAuthority({ authority: changedOwnership, ...target }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED",
);

const thinOwnership = createMovieMentorCreatorStateMutationAuthority({
  request: {},
  authorization: initialAuthorization,
  requestAuthority: { async authorize() { return { authorized: true, principalId: "creator-1", projectId: "project-1" }; } },
});
await assert.rejects(
  () => assertMovieMentorCreatorStateMutationAuthority({ authority: thinOwnership, ...target }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED",
);

await assert.rejects(
  () => assertCreatorStateStoreMutationAuthority({ state: { projectId: "project-1", revision: 5, creatorStateGeneration: 3, creatorStateFingerprint: "fingerprint-5", transition: { source: "creator-memory" } }, expectedRevision: 4 }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED",
);

let durable = null;
let durableWrites = 0;
let raceCalls = 0;
const raceRequestAuthority = {
  async authorize() {
    raceCalls++;
    if (raceCalls === 1) return initialAuthorization;
    const error = new Error("ownership revoked before store write");
    error.code = "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED";
    throw error;
  },
};
const raceCapability = createMovieMentorCreatorStateMutationAuthority({ request: {}, authorization: initialAuthorization, requestAuthority: raceRequestAuthority });
async function readState() {
  if (!durable) { const error = new Error("missing"); error.code = "MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"; throw error; }
  return structuredClone(durable);
}
async function guardedWrite(state, options) {
  await assertCreatorStateStoreMutationAuthority({ state, expectedRevision: options.expectedRevision, creatorStateMutationAuthority: options.creatorStateMutationAuthority });
  durableWrites++;
  durable = structuredClone(state);
  return structuredClone(durable);
}
await assert.rejects(
  () => applyMovieMentorCreatorStateTransition({ projectId: "project-1", creatorSessionId: "session-1", source: "creator-memory", expectedRevision: 0, state: { memoryContext: { beat: "opening" } } }, { readAuthoritativeTurnSource: readState, writeAuthoritativeCreatorState: guardedWrite, creatorStateMutationAuthority: raceCapability }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED",
);
assert.equal(raceCalls, 2, "transition and store must each acquire their own fresh mutation proof");
assert.equal(durableWrites, 0, "revocation between transition proof and irreversible store boundary must block the write");
assert.equal(durable, null);

await assert.rejects(
  () => applyMovieMentorCreatorStateTransition({ creatorSessionId: "session-1", source: "creator-memory", expectedRevision: 0, state: { memoryContext: { beat: "opening" } } }, { readAuthoritativeTurnSource: readState, writeAuthoritativeCreatorState: guardedWrite, creatorStateMutationAuthority: capability }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_PROJECT_REQUIRED",
);

const forgedCapability = Object.freeze({
  domain: MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  schema: MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
  principalId: "creator-1",
  projectId: "project-1",
  async assertCurrentMutation(input) {
    return Object.freeze({ domain: MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN, schema: MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA, authorized: true, currentOwnershipVerified: true, principalId: "creator-1", projectId: "project-1", ownershipRef: "ownership:project-1", ownershipRevision: 1, ...input, revision: input.revision + 1 });
  },
});
await assert.rejects(
  () => assertMovieMentorCreatorStateMutationAuthority({ authority: forgedCapability, ...target }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_INVALID",
);

const gatewaySource = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
const transitionSource = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateTransition.js", import.meta.url), "utf8");
const storeSource = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js", import.meta.url), "utf8");
const decisionSource = fs.readFileSync(new URL("../ai/MovieMentorCreatorDecisionAuthority.js", import.meta.url), "utf8");
const orchestratorSource = fs.readFileSync(new URL("../ai/MovieMentorTurnOrchestrator.js", import.meta.url), "utf8");
const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");

assert.match(gatewaySource, /createMovieMentorCreatorStateMutationAuthority/);
assert.match(gatewaySource, /state=await applyStateTransition\(authorized\.body,\{creatorStateMutationAuthority\}\)/);
assert.match(gatewaySource, /commitCreatorDecision\(input,\{\.\.\.deps,creatorStateMutationAuthority\}\)/);
assert.match(gatewaySource, /commitCreatorDecision:commitDecision/);
assert.match(transitionSource, /await assertMovieMentorCreatorStateMutationAuthority\(/);
assert.match(transitionSource, /return write\(next,\{expectedRevision:next\.transition\.expectedRevision,creatorStateMutationAuthority:deps\.creatorStateMutationAuthority\}\)/);
const writeBoundaryStart = storeSource.indexOf("async function writeAuthoritativeCreatorState");
assert.ok(writeBoundaryStart >= 0, "store must expose the authoritative write boundary");
const writeBoundary = storeSource.slice(writeBoundaryStart);
const storeProofOffset = writeBoundary.indexOf("await assertCreatorStateStoreMutationAuthority");
const storeConnectionOffset = writeBoundary.indexOf("await ensureConnection()");
assert.ok(storeProofOffset >= 0 && storeConnectionOffset >= 0 && storeProofOffset < storeConnectionOffset, "store must prove current mutation authority before connecting to the irreversible write path");
assert.match(storeSource, /sessionIdentityCannotAuthorizeWrites:true/);
assert.match(decisionSource, /creatorStateMutationAuthority:deps\.creatorStateMutationAuthority/);
assert.match(orchestratorSource, /creatorStateMutationAuthority:deps\.creatorStateMutationAuthority/);
assert.match(runtimeSource, /commitCreatorDecision: deps\.commitCreatorDecision/);

console.log("Creator-state mutation authority verification: PASS — identity and revision are not authority; transition and irreversible store boundaries independently re-prove current authenticated ownership, session-only history cannot mint writes, and a revocation race fails closed before durable mutation.");
