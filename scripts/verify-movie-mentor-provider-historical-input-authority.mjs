import assert from "node:assert/strict";
import { resolveHistoricalReconstructionInput } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

console.log("Movie Mentor provider historical-input authority court");

const executionId = "execution-historical-input-all-tasks";
const currentInput = Object.freeze({ universe: "CURRENT-B", creatorStateRevision: 9 });
const historicalInput = Object.freeze({ universe: "HISTORICAL-A", creatorStateRevision: 8 });

function historical(task, slotId) {
  return Object.freeze({
    providerCallId: `provider-call-${slotId}`,
    executionId,
    slotId,
    task,
  });
}

async function expectMissingHistoricalInputRejected(task, slotId) {
  const operation = historical(task, slotId);
  await assert.rejects(
    () => resolveHistoricalReconstructionInput({
      historical: operation,
      currentInput,
      readProviderOperation: async () => Object.freeze({
        authorized: true,
        providerCallId: operation.providerCallId,
        executionId: operation.executionId,
        slotId: operation.slotId,
        task: operation.task,
        // Historical operation identity survived, but the exact input universe did not.
        reconstructionInputDigest: null,
        reconstructionInput: null,
      }),
    }),
    (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_AUTHORITY_REQUIRED",
    `${task} must fail closed rather than borrow current input when historical input is absent`,
  );
}

// A properly bound historical input must outrank a different current universe.
const semantic = historical("movie-mentor-semantic", "semantic");
const resolved = await resolveHistoricalReconstructionInput({
  historical: semantic,
  currentInput,
  readProviderOperation: async () => Object.freeze({
    authorized: true,
    providerCallId: semantic.providerCallId,
    executionId: semantic.executionId,
    slotId: semantic.slotId,
    task: semantic.task,
    reconstructionInputDigest: "digest-historical-a",
    reconstructionInput: historicalInput,
  }),
});
assert.deepEqual(resolved, historicalInput, "durable historical input must outrank today's reconstructed input universe");
assert.notDeepEqual(resolved, currentInput);

// Every recoverable creative task must own the same historical-input prerequisite.
await expectMissingHistoricalInputRejected("movie-mentor-semantic", "semantic");
await expectMissingHistoricalInputRejected("movie-mentor-specialist:story", "story");
await expectMissingHistoricalInputRejected("movie-mentor-specialist:character", "character");
await expectMissingHistoricalInputRejected("movie-mentor-specialist:continuity", "continuity");
await expectMissingHistoricalInputRejected("movie-mentor-synthesis", "synthesis");

console.log("PASS — recovered provider bytes can never borrow today's task input; exact historical input is required for every recoverable provider operation.");
