import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const source = fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js", import.meta.url), "utf8");
assert.match(
  source,
  /\$inc:\{resultCandidateBarrierRevision:1\}/,
  "result-candidate staging must durably publish its irreversible candidate barrier on the execution ledger",
);

const durable = {
  domain: "iband.movie-mentor.inference-execution-store",
  schema: 6,
  executionId: "execution-candidate-forward-admission",
  creatorTurnId: "turn-candidate-forward-admission",
  principalId: "creator-candidate-forward-admission",
  projectId: "project-candidate-forward-admission",
  reservationId: "reservation-candidate-forward-admission",
  requestDigest: "digest-candidate-forward-admission",
  phase: "active",
  ownerId: "worker-candidate-forward-admission",
  leaseGeneration: 1,
  leaseReference: "lease-candidate-forward-admission",
  fencingToken: "fence-candidate-forward-admission",
  leaseAcquiredAt: new Date("2036-01-01T00:00:00.000Z"),
  leaseExpiresAt: new Date("2036-01-01T00:10:00.000Z"),
  maxProviderCalls: 5,
  providerCallsClaimed: 1,
  providerCalls: [{
    providerCallId: "provider-call-semantic",
    slotId: "semantic",
    task: "movie-mentor-semantic",
    state: "admitted",
    leaseGeneration: 1,
    leaseReference: "lease-candidate-forward-admission",
    fencingToken: "fence-candidate-forward-admission",
    admittedAt: new Date("2036-01-01T00:01:00.000Z"),
  }],
  abandonedPredispatchProviderCalls: [],
  providerEffectRealityRevision: 1,
  settlementRealityBarrierRevision: 0,
  resultFinalizationBarrierRevision: 0,
  resultCandidateBarrierRevision: 1,
  closureReference: "",
  frozenProviderCallCount: null,
  frozenProviderCallSetDigest: "",
  closingAt: null,
  closedFromExecutionGeneration: null,
  closurePolicyVersion: "",
  closureCertificateDigest: "",
  closedAt: null,
  finalizedResultReference: "",
  finalizedCandidateReference: "",
  finalizedResultDigest: "",
  resultFinalizedAt: null,
  settledResultReference: "",
  settledCandidateReference: "",
  settledResultDigest: "",
  settledAt: null,
  abortedAt: null,
  abortReason: "",
  compensatedAt: null,
  compensationReason: "",
  quarantinedAt: null,
  quarantineReason: "",
  quarantinedFromPhase: "",
};

let observedFilter = null;
const query = (value) => ({
  lean() { return this; },
  exec: async () => structuredClone(value),
});
const fakeModel = {
  findOne() { return query(durable); },
  findOneAndUpdate(filter, update) {
    observedFilter = structuredClone(filter);
    const candidateBarrier = filter?.resultCandidateBarrierRevision;
    const candidateBarrierMatches = candidateBarrier === undefined
      || candidateBarrier === durable.resultCandidateBarrierRevision
      || candidateBarrier?.$in?.includes?.(durable.resultCandidateBarrierRevision)
      || (durable.resultCandidateBarrierRevision == null && candidateBarrier?.$in?.includes?.(null));
    if (!candidateBarrierMatches) return query(null);
    const next = structuredClone(durable);
    const call = structuredClone(update?.$push?.providerCalls);
    if (call) {
      next.providerCalls.push(call);
      next.providerCallsClaimed += 1;
    }
    return query(next);
  },
};

const store = createMovieMentorInferenceExecutionMongoStore({
  mongoModel: fakeModel,
  reservationCollection: false,
});

const result = await store.claimProviderCall({
  executionId: durable.executionId,
  ownerId: durable.ownerId,
  leaseGeneration: durable.leaseGeneration,
  leaseReference: durable.leaseReference,
  fencingToken: durable.fencingToken,
  providerCallId: "provider-call-story-after-candidate",
  slotId: "story",
  task: "movie-mentor-specialist:story",
  admittedAt: new Date("2036-01-01T00:02:00.000Z"),
});

assert.equal(
  result.claimed,
  false,
  "a durable result candidate must end new forward provider-call admission for that execution",
);
assert.ok(
  observedFilter && (
    observedFilter.resultCandidateBarrierRevision === 0
    || observedFilter.resultCandidateBarrierRevision?.$in?.includes?.(0)
  ),
  "provider-call admission must atomically require that no result-candidate barrier has already committed",
);

console.log("Movie Mentor result-candidate forward provider admission authority verifier passed.");
console.log("LAW: ONCE AN IMMUTABLE RESULT CANDIDATE IS DURABLE, THAT EXECUTION MAY NOT MINT NEW FORWARD PROVIDER-CALL AUTHORITY.");
