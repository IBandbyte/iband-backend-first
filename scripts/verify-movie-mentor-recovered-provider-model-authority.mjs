import assert from "node:assert/strict";
import crypto from "node:crypto";
import { recoverPreviouslyAdmittedProviderResult } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

const providerCallId = "provider-call-model-recovery-1";
const executionId = "execution-model-recovery-1";
const slotId = "semantic";
const task = "semantic-interpretation";
const historicalModel = "gpt-historical";
const historicalTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

const decision = Object.freeze({
  dispatchAuthorized: false,
  reason: "provider-call-slot-already-admitted",
  existingProviderCallId: providerCallId,
  existingProviderCall: Object.freeze({ providerCallId, executionId, slotId, task }),
});
const execution = Object.freeze({
  executionId,
  ownerId: "worker-model-recovery",
  leaseGeneration: 3,
});
const reconstructionInput = Object.freeze({ creatorMessage: "historical input" });
const reconstructionInputDigest = crypto
  .createHash("sha256")
  .update(JSON.stringify(canonicalize(reconstructionInput)))
  .digest("hex");
const operation = Object.freeze({
  authorized: true,
  providerCallId,
  providerOperationId: providerCallId,
  executionId,
  slotId,
  task,
  providerTarget: historicalTarget,
  providerModel: historicalModel,
  reconstructionInputDigest,
  reconstructionInput,
});

let observedProviderOperation = null;
await recoverPreviouslyAdmittedProviderResult({
  decision,
  execution,
  slotId,
  task,
  input: Object.freeze({ creatorMessage: "current input must not win" }),
  recoverProviderOutcome: async () => Object.freeze({
    outcome: "CONFIRMED_EFFECT",
    recovered: true,
    recoveryAuthorized: true,
    redispatchAuthorized: false,
    refundAuthorized: false,
    providerCallId,
    executionId,
    slotId,
    task,
    externalEffectId: "resp-model-recovery-1",
    recoveredProviderResponse: Object.freeze({ id: "resp-model-recovery-1", model: historicalModel }),
    recoveryOwnerId: execution.ownerId,
    recoveryLeaseGeneration: execution.leaseGeneration,
  }),
  readProviderOperation: async () => operation,
  reconstructRecoveredResult: async ({ providerOperation }) => {
    observedProviderOperation = providerOperation;
    return Object.freeze({ ok: true });
  },
});

assert.equal(
  observedProviderOperation?.providerModelAuthorityBound,
  true,
  "recovered reconstruction must receive explicit historical provider-model authority rather than losing it at the recovery boundary",
);
assert.equal(
  observedProviderOperation?.providerModel,
  historicalModel,
  "recovered reconstruction must receive the exact durable provider model that authorized the historical operation",
);
assert.deepEqual(
  observedProviderOperation?.providerTarget,
  historicalTarget,
  "recovered reconstruction must receive the exact durable provider target that authorized the historical operation",
);

console.log("Movie Mentor recovered provider model authority verifier passed.");
