import assert from "node:assert/strict";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";
import { resolveHistoricalReconstructionInput } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

console.log("Movie Mentor provider historical-input authority court");

const executionId = "execution-historical-input-all-tasks";
const currentInput = Object.freeze({ universe: "CURRENT-B", creatorStateRevision: 9 });
const historicalInput = Object.freeze({ universe: "HISTORICAL-A", creatorStateRevision: 8 });
const providerModel = "gpt-test";
const providerTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});

function historical(task, slotId) {
  return Object.freeze({ providerCallId: `provider-call-${slotId}`, executionId, slotId, task });
}
function durableOperation(operation, reconstructionInputDigest, reconstructionInput) {
  return Object.freeze({
    authorized: true,
    providerCallId: operation.providerCallId,
    providerOperationId: operation.providerCallId,
    executionId: operation.executionId,
    slotId: operation.slotId,
    task: operation.task,
    providerTarget,
    providerModel,
    reconstructionInputDigest,
    reconstructionInput,
  });
}
async function expectMissingHistoricalInputRejected(task, slotId) {
  const operation = historical(task, slotId);
  await assert.rejects(
    () => resolveHistoricalReconstructionInput({
      historical: operation,
      currentInput,
      readProviderOperation: async () => durableOperation(operation, null, null),
    }),
    (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_AUTHORITY_REQUIRED",
    `${task} must fail closed rather than borrow current input when historical input is absent`,
  );
}

const semantic = historical("movie-mentor-semantic", "semantic");
const resolved = await resolveHistoricalReconstructionInput({
  historical: semantic,
  currentInput,
  readProviderOperation: async () => durableOperation(
    semantic,
    digestMovieMentorProviderReconstructionInput(historicalInput),
    historicalInput,
  ),
});
assert.deepEqual(resolved, historicalInput, "durable historical input must outrank today's reconstructed input universe");
assert.notDeepEqual(resolved, currentInput);

await expectMissingHistoricalInputRejected("movie-mentor-semantic", "semantic");
await expectMissingHistoricalInputRejected("movie-mentor-specialist:story", "story");
await expectMissingHistoricalInputRejected("movie-mentor-specialist:character", "character");
await expectMissingHistoricalInputRejected("movie-mentor-specialist:continuity", "continuity");
await expectMissingHistoricalInputRejected("movie-mentor-synthesis", "synthesis");

function turnAuthority(revision, generation, fingerprint, snapshotReference) {
  return Object.freeze({ revision, snapshotReference, creatorState: Object.freeze({ generation, fingerprint }) });
}
function semanticAuthorityInput(authority, label) {
  return Object.freeze({
    message: "Keep current creator reality.",
    context: Object.freeze({ projectId: "project-ci-state-universe", turnContextAuthority: authority, label }),
  });
}
const historicalTurnAuthority = turnAuthority(8, 4, "fingerprint-eight", "snapshot-eight");
const currentTurnAuthority = turnAuthority(9, 5, "fingerprint-nine", "snapshot-nine");
const historicalSemanticInput = semanticAuthorityInput(historicalTurnAuthority, "historical");
const currentSameUniverseInput = semanticAuthorityInput(historicalTurnAuthority, "current-non-authority-difference");
const currentChangedUniverseInput = semanticAuthorityInput(currentTurnAuthority, "current-changed-authority");
const historicalSemanticOperation = durableOperation(
  semantic,
  digestMovieMentorProviderReconstructionInput(historicalSemanticInput),
  historicalSemanticInput,
);

const sameUniverseResolved = await resolveHistoricalReconstructionInput({
  historical: semantic,
  currentInput: currentSameUniverseInput,
  readProviderOperation: async () => historicalSemanticOperation,
});
assert.deepEqual(sameUniverseResolved, historicalSemanticInput, "same creator-state authority universe must still recover exact historical provider input");

await assert.rejects(
  () => resolveHistoricalReconstructionInput({
    historical: semantic,
    currentInput: currentChangedUniverseInput,
    readProviderOperation: async () => historicalSemanticOperation,
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",
  "Backend CI must reject historical provider input crossing into a different current creator-state authority universe",
);

console.log("PASS — recovered provider bytes can never borrow today's task input; exact historical input is required for every recoverable provider operation.");
console.log("PASS — Backend CI owns recovered creator-state universe binding: historical input may survive retry, stale creator-state authority may not.");
