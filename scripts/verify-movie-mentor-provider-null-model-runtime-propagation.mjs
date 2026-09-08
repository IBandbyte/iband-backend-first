import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const providerCall = Object.freeze({
  dispatchAuthorized: true,
  providerCallId: "provider-call-null-model-runtime",
  executionId: "execution-null-model-runtime",
  slotId: "semantic",
  task: "movie-mentor-semantic",
});

const providerTarget = Object.freeze({
  provider: "generic-http",
  adapter: "generic-http",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "none",
  dispatchModel: null,
});

const execution = Object.freeze({ authorized: true, executionId: providerCall.executionId });
let observedProviderOperation = null;

const inferenceExecutionAuthority = {
  async claimProviderCall() { return providerCall; },
  async bindProviderReconstructionInput() { return { authorized: true, inputBound: true }; },
  async beginProviderDispatch() {
    return {
      dispatchAuthorized: true,
      providerOperationIdentity: {
        providerOperationId: providerCall.providerCallId,
        executionId: providerCall.executionId,
        slotId: providerCall.slotId,
        task: providerCall.task,
        providerTarget,
        providerModel: null,
        currentModelVerified: true,
      },
    };
  },
  async assertProviderDispatch() {
    return {
      dispatchAuthorized: true,
      providerOperationIdentity: {
        providerOperationId: providerCall.providerCallId,
        executionId: providerCall.executionId,
        slotId: providerCall.slotId,
        task: providerCall.task,
        providerTarget,
        providerModel: null,
        currentModelVerified: true,
      },
    };
  },
  async contributeProviderEffectEvidence() {},
};

const deps = createFencedInferenceOrchestrationDeps({
  execution,
  inferenceExecutionAuthority,
  deps: {
    interpretSemantics: async (_input, context) => {
      observedProviderOperation = context.providerOperation;
      return { semantic: true };
    },
  },
});

await deps.interpretSemantics({ message: "prove null model propagation" });

assert.ok(observedProviderOperation, "runtime must pass provider operation identity to the provider adapter boundary");
assert.equal(observedProviderOperation.providerOperationId, providerCall.providerCallId);
assert.equal(observedProviderOperation.providerTarget.dispatchModel, null);
assert.equal(
  observedProviderOperation.providerModelAuthorityBound,
  true,
  "an explicitly authorized null model must cross the runtime boundary as owned model authority rather than disappearing into absence",
);
assert.equal(observedProviderOperation.providerModel, null);

console.log("✓ runtime preserves explicit null-model authority through the provider-operation envelope");
console.log("LAW: NULL MAY BE THE AUTHORIZED VALUE. ABSENCE OF PROOF IS NOT THE SAME THING.");
console.log("Movie Mentor provider null-model runtime propagation gate: GREEN");
