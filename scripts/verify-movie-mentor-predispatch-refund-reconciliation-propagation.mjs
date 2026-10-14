import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";
import { releaseFailedUnclaimedExecution } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor predispatch refund reconciliation propagation — VERIFIER FIRST");

const executionId = "execution-predispatch-propagation";
const providerCallId = "provider-call-predispatch-propagation";
let observed = null;

const settlementAuthority = createMovieMentorInferenceSettlementReconciliationAuthority({
  store: {
    settleCanonicalResult: async () => ({ authorized: false, settled: false }),
    releaseUnclaimedReservation: async (input) => {
      observed = structuredClone(input);
      return { authorized: false, released: false, outcome: "reserved", reason: "verifier-observation-only", executionId };
    },
    releaseUnboundReservation: async () => ({ authorized: false, released: false }),
    terminallyReleaseAuthorizedReservation: async () => ({ authorized: false, released: false }),
  },
});

await assert.rejects(
  releaseFailedUnclaimedExecution({
    execution: { executionId },
    settlementAuthority,
    error: Object.assign(new Error("provider operation never became durable"), {
      refundAuthorized: true,
      refundReason: "provider-operation-never-became-durable",
      providerCallId,
    }),
  }),
  (error) => error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED",
);

assert.ok(observed, "the actual reconciliation authority must invoke the durable store");
assert.equal(observed.executionId, executionId);
assert.equal(
  observed.allowPredispatchClaimAbandonment,
  true,
  "the exact upstream predispatch absence proof must survive reconciliation into the physical store",
);
assert.equal(
  observed.predispatchProviderCallId,
  providerCallId,
  "the exact claimed provider call identity must survive reconciliation into the physical store",
);

console.log("Movie Mentor predispatch refund reconciliation propagation — GREEN");
