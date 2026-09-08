import assert from "node:assert/strict";
import { reconstructRecoveredMovieMentorSemanticResult } from "../ai/MovieMentorRecoveredSemanticResult.js";

const providerOperation = Object.freeze({
  providerOperationId: "provider-call-synthesis-neighbour",
  executionId: "execution-one",
  slotId: "synthesis",
  task: "movie-mentor-synthesis",
  providerTarget: Object.freeze({
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "a".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  }),
  providerModelAuthorityBound: true,
  providerModel: "gpt-test",
});

const recoveredProviderResponse = Object.freeze({
  id: "resp-semantic-neighbour",
  model: "gpt-test",
  output_text: JSON.stringify({
    understoodContext: [],
    provisionalContext: [],
    unresolvedContext: [],
    clarificationNeeded: [],
    readyToAdvance: true,
    recommendedStageId: null,
    recommendedTaskId: null,
    nextAction: null,
    resumeNote: null,
  }),
});

assert.throws(
  () => reconstructRecoveredMovieMentorSemanticResult({
    input: Object.freeze({ message: "Keep the premise unchanged." }),
    providerOperation,
    recoveredProviderResponse,
    recovery: Object.freeze({ recoveryOwnerId: "worker-one", recoveryLeaseGeneration: 1 }),
  }),
  (error) => error?.code === "SEMANTIC_RECOVERED_PROVIDER_OPERATION_BINDING_INVALID",
  "semantic reconstruction must reject recovered bytes carrying a neighbouring provider task identity rather than borrowing upstream task proof",
);

console.log("Movie Mentor recovered semantic task authority verifier passed.");
