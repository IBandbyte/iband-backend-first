import assert from "node:assert/strict";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";
import { releaseFailedUnclaimedExecution } from "../ai/MovieMentorTurnRuntime.js";

const callId = "provider-call-refund-provenance-1";
const executionId = "execution-refund-provenance-1";
const operation = {
  providerCallId: callId,
  executionId,
  slotId: "semantic",
  task: "movie-mentor-semantic",
  providerTarget: {
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "a".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  },
};

let durableOperation = null;
let durableEffect = null;

const recovery = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: async (providerCallId) =>
    providerCallId === callId ? structuredClone(durableOperation) : null,
  readProviderEffectReality: async (providerCallId) =>
    providerCallId === callId ? structuredClone(durableEffect) : null,
  recoverProviderResponse: async () => {
    throw new Error("missing-operation refund proof must never perform provider recovery I/O");
  },
});

console.log("Provider-operation absence refund provenance — verifier first");

// The upstream recovery authority may mint only a narrow candidate refund proof when
// the exact durable provider operation is absent.
const absence = await recovery.reconcile({ providerCallId: callId });
assert.equal(absence.authorized, false);
assert.equal(absence.outcome, "STILL_UNKNOWN");
assert.equal(absence.refundAuthorized, true);
assert.equal(absence.refundReason, "provider-operation-never-became-durable");
assert.equal(absence.providerCallId, callId);
assert.equal(absence.redispatchAuthorized, false);

// If operation reality already exists, UNKNOWN is not refundable.
durableOperation = structuredClone(operation);
const presentUnknown = await recovery.reconcile({ providerCallId: callId });
assert.equal(presentUnknown.outcome, "STILL_UNKNOWN");
assert.equal(presentUnknown.refundAuthorized, false);
durableOperation = null;

// Simulate the dangerous interval: recovery observed absence, then the provider
// operation became durable before settlement attempts to restore creator credit.
durableOperation = structuredClone(operation);
let releaseCalls = 0;
const settlementAuthority = {
  async releaseUnclaimed(input = {}) {
    releaseCalls += 1;
    assert.equal(input.executionId, executionId);
    assert.equal(input.allowPredispatchClaimAbandonment, true);
    assert.equal(input.predispatchProviderCallId, callId);

    // This models the production settlement store's independent durable re-read:
    // stale absence provenance cannot authorize release once operation reality exists.
    if (durableOperation || durableEffect) {
      return {
        authorized: false,
        released: false,
        outcome: "reserved",
        reason: "provider-dispatch-reality-exists",
        executionId,
        providerCallsClaimed: 1,
      };
    }
    return { authorized: true, released: true, outcome: "released", executionId };
  },
};

await assert.rejects(
  () => releaseFailedUnclaimedExecution({
    execution: { executionId },
    settlementAuthority,
    error: absence,
  }),
  (error) =>
    error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED"
    && error?.reason === "provider-dispatch-reality-exists",
);
assert.equal(releaseCalls, 1);

// Forged or broadened refund provenance must not enable the exceptional abandonment path.
for (const forged of [
  { refundAuthorized: true, refundReason: "anything-else", providerCallId: callId },
  { refundAuthorized: false, refundReason: "provider-operation-never-became-durable", providerCallId: callId },
]) {
  let observed = null;
  const denyingSettlement = {
    async releaseUnclaimed(input = {}) {
      observed = structuredClone(input);
      return {
        authorized: false,
        released: false,
        outcome: "reserved",
        reason: "provider-call-claims-exist",
        executionId,
        providerCallsClaimed: 1,
      };
    },
  };
  await assert.rejects(
    () => releaseFailedUnclaimedExecution({
      execution: { executionId },
      settlementAuthority: denyingSettlement,
      error: forged,
    }),
    (error) => error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED",
  );
  assert.equal(observed.allowPredispatchClaimAbandonment, false);
}

console.log("✓ missing durable provider operation mints only exact candidate refund provenance");
console.log("✓ an existing operation with UNKNOWN effect reality mints zero refund authority");
console.log("✓ stale operation-absence provenance cannot survive settlement's durable reality recheck");
console.log("✓ broadened/forged refund reasons cannot enable predispatch claim abandonment");
console.log("LAW: PROVIDER-OPERATION ABSENCE MAY REQUEST A REFUND PROOF; IT MAY NOT AUTHORIZE CREDIT RESTORATION.");
console.log("LAW: SETTLEMENT DURABLE REALITY OUTRANKS EARLIER ABSENCE OBSERVATION.");
console.log("Provider-operation absence refund provenance authority gate: GREEN");
