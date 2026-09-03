import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const clone = (value) => value == null ? value : structuredClone(value);
let durable = null;
let id = 0;
const now = () => new Date("2031-01-01T00:00:00.000Z");
const store = {
  async readExecution(executionId) { return durable?.executionId === executionId ? clone(durable) : null; },
  async readExecutionByCreatorTurn({ principalId, projectId, creatorTurnId } = {}) {
    return durable && durable.principalId === principalId && durable.projectId === projectId && durable.creatorTurnId === creatorTurnId ? clone(durable) : null;
  },
  async createExecution(next) { if (durable) return null; durable = clone(next); return clone(durable); },
  async replaceExecution(next) { durable = clone(next); return clone(durable); },
  async claimProviderCall() { return { claimed: false, execution: clone(durable) }; },
};
const authority = createMovieMentorInferenceExecutionLeaseAuthority({ store, now, randomId: () => `candidate-owner-${++id}` });
const genuine = await authority.openExecution({ creatorTurnId:"turn-candidate-owner", principalId:"creator-candidate-owner", projectId:"project-candidate-owner", reservationId:"reservation-candidate-owner", requestDigest:"digest-candidate-owner", ownerId:"worker-candidate-owner" });
assert.equal(genuine.authorized, true);
assert.equal(typeof authority.isOwnedExecutionProof, "function", "lease authority must expose a private-registry-backed owner predicate for irreversible composed consumers");
assert.equal(authority.isOwnedExecutionProof(genuine), true, "exact owner-issued live execution proof must be recognized");
assert.equal(authority.isOwnedExecutionProof(Object.freeze({ ...genuine })), false, "structurally perfect copied execution proof must not inherit issuer provenance");
durable = { ...durable, phase:"quarantined", quarantinedFromPhase:"active", quarantineReason:"warp-42-history" };
const historical = await authority.findExecutionByCreatorTurn({ creatorTurnId:genuine.creatorTurnId, principalId:genuine.principalId, projectId:genuine.projectId, requestDigest:genuine.requestDigest });
assert.equal(historical.authorized, true);
assert.equal(historical.executionAuthorized, false);
assert.equal(authority.isOwnedExecutionProof(historical), false, "genuine historical owner evidence must not satisfy forward execution owner proof");

const composition = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js", import.meta.url), "utf8");
assert.match(composition, /isOwnedExecutionProof/, "production composition must consume lease-authority provenance at result-candidate staging");
assert.doesNotMatch(composition, /stageResultCandidate:durableCandidateStore\.stageCandidate/, "production composition must not expose the candidate store directly across the irreversible staging boundary");

console.log("✓ exact live execution owner proof is distinguishable from a structural copy");
console.log("✓ genuine historical execution evidence has zero forward candidate authority");
console.log("✓ production result staging consumes execution issuer provenance before durable candidate write");
console.log("LAW: OWNER-ISSUED LIVE EXECUTION PROOF → CURRENT DURABLE REALITY → IRREVERSIBLE RESULT CANDIDATE");
console.log("LAW: COPY OR HISTORICAL PROOF → ZERO RESULT-CANDIDATE AUTHORITY");
console.log("Zorg: Can the candidate ask the execution if it is genuine? Kraken: THAT IS SELF-ATTESTATION, ZORG.");
console.log("Gates of Progress result-candidate owner-proof torture: GREEN");
