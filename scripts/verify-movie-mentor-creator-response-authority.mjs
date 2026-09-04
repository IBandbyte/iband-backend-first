import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  assertCreatorResponseAuthority,
  replayTerminalTurn,
  recoverStagedResultTurn,
} from "../ai/MovieMentorTurnRuntime.js";

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const payload = { response: "creator-result", metadata: { source: "verified" } };
const resultDigest = digest(payload);
const execution = Object.freeze({
  found: true,
  phase: "settled",
  executionId: "execution-1",
  creatorTurnId: "turn-1",
  principalId: "creator-1",
  projectId: "project-1",
  reservationId: "reservation-1",
  requestDigest: "request-digest-1",
});
const canonical = Object.freeze({
  authorized: true,
  committed: true,
  currentRealityVerified: true,
  candidateLineageVerified: true,
  resultFinalizationVerified: true,
  executionPhase: "settled",
  providerEffectRealityRevision: 7,
  resultReference: "result-1",
  candidateReference: "candidate-1",
  executionId: execution.executionId,
  creatorTurnId: execution.creatorTurnId,
  principalId: execution.principalId,
  projectId: execution.projectId,
  reservationId: execution.reservationId,
  requestDigest: execution.requestDigest,
  closureReference: "closure-1",
  closureCertificateDigest: "closure-digest-1",
  resultDigest,
  resultPayload: payload,
});
const settlement = Object.freeze({
  authorized: true,
  settled: true,
  outcome: "consumed",
  resultFinalizationVerified: true,
  executionPhase: "settled",
  providerEffectRealityRevision: 7,
  executionId: canonical.executionId,
  principalId: canonical.principalId,
  projectId: canonical.projectId,
  reservationId: canonical.reservationId,
  resultReference: canonical.resultReference,
  resultDigest: canonical.resultDigest,
  closureCertificateDigest: canonical.closureCertificateDigest,
  idempotent: true,
});

assert.equal(assertCreatorResponseAuthority({ canonical, settlement, execution }), true);

for (const marker of ["currentRealityVerified", "candidateLineageVerified", "resultFinalizationVerified"]) {
  assert.throws(
    () => assertCreatorResponseAuthority({ canonical: { ...canonical, [marker]: false }, settlement, execution }),
    (error) => error.code === "MOVIE_MENTOR_CREATOR_RESPONSE_CANONICAL_AUTHORITY_REQUIRED",
    `${marker} must be owned at the creator response boundary`,
  );
}

assert.throws(
  () => assertCreatorResponseAuthority({ canonical: { ...canonical, resultPayload: { response: "tampered" } }, settlement, execution }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_RESPONSE_DIGEST_INVALID",
  "creator response boundary must recompute the canonical payload digest",
);

for (const [key, value] of [
  ["resultReference", "other-result"],
  ["resultDigest", "other-digest"],
  ["reservationId", "other-reservation"],
  ["closureCertificateDigest", "other-closure"],
  ["projectId", "other-project"],
]) {
  assert.throws(
    () => assertCreatorResponseAuthority({ canonical, settlement: { ...settlement, [key]: value }, execution }),
    (error) => error.code === "MOVIE_MENTOR_CREATOR_RESPONSE_BINDING_INVALID",
    `settlement ${key} must bind the exact canonical universe`,
  );
}

assert.throws(
  () => assertCreatorResponseAuthority({ canonical, settlement, execution: { ...execution, creatorTurnId: "other-turn" } }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_RESPONSE_EXECUTION_BINDING_INVALID",
  "creator-visible result must bind the exact durable execution universe",
);

await assert.rejects(
  () => replayTerminalTurn({
    existing: execution,
    inferenceExecutionAuthority: {
      readCanonicalResult: async () => ({ ...canonical, candidateLineageVerified: false }),
    },
    settlementAuthority: { reconcile: async () => settlement },
  }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_RESPONSE_CANONICAL_AUTHORITY_REQUIRED",
  "terminal replay must not inherit a neighbour's bare authorized flag",
);

await assert.rejects(
  () => recoverStagedResultTurn({
    existing: { ...execution, phase: "closed" },
    inferenceExecutionAuthority: {
      readResultCandidate: async () => ({ candidateReference: canonical.candidateReference, resultDigest, resultPayload: payload }),
      reconcileExecutionClosure: async () => ({ authorized: true, closed: true, executionId: execution.executionId }),
      readCanonicalResult: async () => ({ authorized: false, committed: false }),
      commitCanonicalResult: async () => ({ ...canonical, currentRealityVerified: false }),
    },
    settlementAuthority: { reconcile: async () => settlement },
  }),
  (error) => error.code === "MOVIE_MENTOR_CREATOR_RESPONSE_CANONICAL_AUTHORITY_REQUIRED",
  "recovered canonical history must not cross the creator response boundary without current proof",
);

const source = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
for (const proof of ["currentRealityVerified", "candidateLineageVerified", "resultFinalizationVerified", "MOVIE_MENTOR_CREATOR_RESPONSE_DIGEST_INVALID", "MOVIE_MENTOR_CREATOR_RESPONSE_BINDING_INVALID", "MOVIE_MENTOR_CREATOR_RESPONSE_EXECUTION_BINDING_INVALID"]) {
  assert.match(source, new RegExp(proof));
}
assert.match(source, /assertCreatorResponseAuthority\(\{ canonical, settlement, execution/);
assert.match(source, /resultResponse\(canonical, settlement, \{ replayed: true, execution: existing \}\)/);
assert.match(source, /resultResponse\(canonical, settlement, \{ execution \}\)/);

console.log("✅ Movie Mentor creator response authority verified: current canonical proof + local digest + exact execution/settlement binding are required before creator-visible replay or response.");
console.log("🧭 Law: NO COMPONENT GETS CREDIT FOR ITS NEIGHBOUR'S PROOF. THE CREATOR-RESPONSE BOUNDARY PROVES THE EXACT RESULT UNIVERSE IT EXPOSES.");
