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
assert.equal(genuine.executionAuthorized, true);
const liveFence = await authority.assertFence(genuine);
assert.equal(liveFence.authorized, true, "exact owner-issued live execution proof must cross the forward-authority fence");
const copiedFence = await authority.assertFence(Object.freeze({ ...genuine }));
assert.equal(copiedFence.authorized, false, "structurally perfect copied execution proof must not inherit issuer provenance");
assert.equal(copiedFence.reason, "execution-owner-proof-required");
durable = { ...durable, phase:"quarantined", quarantinedFromPhase:"active", quarantineReason:"warp-42-history" };
const historical = await authority.findExecutionByCreatorTurn({ creatorTurnId:genuine.creatorTurnId, principalId:genuine.principalId, projectId:genuine.projectId, requestDigest:genuine.requestDigest });
assert.equal(historical.authorized, true, "historical evidence remains genuine authority-issued provenance");
assert.equal(historical.executionAuthorized, false, "historical evidence carries zero forward execution authority");
const historicalFence = await authority.assertFence(historical);
assert.equal(historicalFence.authorized, false, "genuine historical owner evidence must not cross the forward execution fence");

const composition = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js", import.meta.url), "utf8");
assert.match(composition, /stageResultCandidate/, "production composition must own the result-candidate staging boundary");
assert.match(composition, /leaseAuthority\.assertFence\(execution\)/, "production result staging must consume exact lease-authority provenance and current forward authority before candidate staging");
assert.doesNotMatch(composition, /stageResultCandidate:durableCandidateStore\.stageCandidate/, "production composition must not expose the candidate store directly across the irreversible staging boundary");

console.log("✓ exact live execution owner proof crosses the lease-authority forward fence");
console.log("✓ structurally perfect copied execution proof has zero issuer provenance");
console.log("✓ genuine historical execution evidence survives as history but has zero forward candidate authority");
console.log("✓ production result staging consumes lease-authority provenance and current durable fence before candidate write");
console.log("LAW: OWNER-ISSUED PROVENANCE MAY SURVIVE; FORWARD EXECUTION AUTHORITY MAY NOT");
console.log("LAW: OWNER-ISSUED LIVE EXECUTION PROOF → CURRENT DURABLE FENCE → IRREVERSIBLE RESULT CANDIDATE");
console.log("LAW: COPY OR HISTORICAL PROOF → ZERO RESULT-CANDIDATE AUTHORITY");
console.log("Zorg: Can the candidate ask the execution if it is genuine? Kraken: THAT IS SELF-ATTESTATION, ZORG.");
console.log("Gates of Progress result-candidate owner-proof torture: GREEN");
