import assert from "node:assert/strict";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const providerCallId = "provider-call-authorized";
const target = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});

const operation = Object.freeze({
  providerCallId,
  providerOperationId: providerCallId,
  executionId: "execution-authorized",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  providerTarget: target,
  boundAt: "2034-01-01T00:00:00.000Z",
});

const effect = Object.freeze({
  providerCallId,
  executionId: operation.executionId,
  slotId: operation.slotId,
  task: operation.task,
  state: "confirmed",
  evidence: [Object.freeze({
    externalEffectId: "resp_authorized",
    provider: "openai",
    observedAt: "2034-01-01T00:00:01.000Z",
    source: "provider-response",
  })],
});

const authority = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: async (id) => id === providerCallId ? operation : null,
  readProviderEffectReality: async (id) => id === providerCallId ? effect : null,
  resolveCurrentTarget: () => target,
  recoverProviderResponse: async (request) => ({
    provider: request.providerTarget.provider,
    externalEffectId: request.externalEffectId,
    providerOperationId: "provider-call-different-operation",
    response: {
      id: request.externalEffectId,
      status: "completed",
      output_text: "{}",
    },
  }),
});

const result = await authority.reconcile({ providerCallId });

assert.equal(
  result.outcome,
  "CONFLICTING_EFFECT",
  "recovery bytes returned under a different provider operation identity must be rejected as a conflicting effect",
);
assert.equal(result.recovered, false, "cross-operation recovery bytes must never become recovered authority");
assert.equal(
  result.reason,
  "provider-recovery-operation-binding-conflict",
  "the recovery authority must own exact provider-operation binding instead of borrowing that proof from the adapter",
);

console.log("✓ provider outcome recovery rejects bytes attributed to a different durable provider operation");
console.log("LAW: RECOVERED PROVIDER BYTES MUST RETURN UNDER THE SAME DURABLE PROVIDER OPERATION THAT AUTHORIZED RECOVERY.");
console.log("Movie Mentor provider recovery operation-binding authority gate: GREEN");
