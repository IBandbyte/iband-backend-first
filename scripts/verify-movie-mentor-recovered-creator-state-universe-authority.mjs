import assert from "node:assert/strict";
import { digestMovieMentorProviderReconstructionInput } from "../ai/MovieMentorProviderOperationAuthority.js";
import { recoverPreviouslyAdmittedProviderResult } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

console.log("Movie Mentor recovered creator-state universe authority court");

const execution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-recovered-state-universe",
  ownerId: "worker-two",
  leaseGeneration: 2,
});
const historical = Object.freeze({
  providerCallId: "provider-call-semantic-state-universe",
  executionId: execution.executionId,
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
const decision = Object.freeze({
  authorized: false,
  dispatchAuthorized: false,
  reason: "provider-call-slot-already-admitted",
  existingProviderCallId: historical.providerCallId,
  existingProviderCall: historical,
});
const providerTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});
const recoveredProviderResponse = Object.freeze({ id: "resp-state-universe", model: "test-model", output_text: "{}" });

function authority(revision, generation, fingerprint, snapshotReference) {
  return Object.freeze({
    revision,
    snapshotReference,
    creatorState: Object.freeze({ generation, fingerprint }),
  });
}
function semanticInput(turnContextAuthority, label) {
  return Object.freeze({
    message: "Keep the creator's current reality.",
    context: Object.freeze({
      projectId: "project-state-universe",
      turnContextAuthority,
      nonAuthorityLabel: label,
    }),
  });
}
const historicalAuthority = authority(8, 4, "fingerprint-eight", "snapshot-eight");
const currentAuthority = authority(9, 5, "fingerprint-nine", "snapshot-nine");
const historicalInput = semanticInput(historicalAuthority, "historical-provider-input");
const sameUniverseCurrentInput = semanticInput(historicalAuthority, "current-retry-non-authority-difference");
const changedUniverseCurrentInput = semanticInput(currentAuthority, "current-retry-after-creator-state-change");

function readProviderOperation() {
  return Object.freeze({
    authorized: true,
    providerCallId: historical.providerCallId,
    providerOperationId: historical.providerCallId,
    executionId: historical.executionId,
    slotId: historical.slotId,
    task: historical.task,
    providerTarget,
    providerModel: "test-model",
    reconstructionInputDigest: digestMovieMentorProviderReconstructionInput(historicalInput),
    reconstructionInput: structuredClone(historicalInput),
  });
}
async function recoverProviderOutcome() {
  return Object.freeze({
    outcome: "CONFIRMED_EFFECT",
    recovered: true,
    recoveryAuthorized: true,
    redispatchAuthorized: false,
    refundAuthorized: false,
    providerCallId: historical.providerCallId,
    executionId: historical.executionId,
    slotId: historical.slotId,
    task: historical.task,
    externalEffectId: recoveredProviderResponse.id,
    recoveredProviderResponse,
    recoveryOwnerId: execution.ownerId,
    recoveryLeaseGeneration: execution.leaseGeneration,
  });
}
const reconstructRecoveredResult = ({ input }) => Object.freeze({ success: true, reconstructedInput: structuredClone(input) });

const sameUniverse = await recoverPreviouslyAdmittedProviderResult({
  decision,
  execution,
  slotId: historical.slotId,
  task: historical.task,
  input: sameUniverseCurrentInput,
  recoverProviderOutcome,
  readProviderOperation,
  reconstructRecoveredResult,
});
assert.deepEqual(
  sameUniverse.reconstructedInput,
  historicalInput,
  "non-authority differences may still recover exact historical provider input when the creator-state universe is identical",
);

await assert.rejects(
  () => recoverPreviouslyAdmittedProviderResult({
    decision,
    execution,
    slotId: historical.slotId,
    task: historical.task,
    input: changedUniverseCurrentInput,
    recoverProviderOutcome,
    readProviderOperation,
    reconstructRecoveredResult,
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT",
  "historical provider bytes must not re-enter a retry whose current creator-state revision/generation/fingerprint/snapshot belongs to another authority universe",
);

console.log("LAW: HISTORICAL PROVIDER INPUT MAY SURVIVE RETRY. HISTORICAL CREATOR-STATE AUTHORITY MAY NOT CROSS INTO A DIFFERENT CURRENT CREATOR-STATE UNIVERSE.");
console.log("Movie Mentor recovered creator-state universe authority verifier passed.");
