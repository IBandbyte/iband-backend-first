import assert from "node:assert/strict";
import { resolveHistoricalReconstructionInput } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

console.log("Movie Mentor provider historical-input integrity authority court");

const historical = Object.freeze({
  providerCallId: "provider-call-integrity-proof",
  executionId: "execution-integrity-proof",
  slotId: "semantic",
  task: "movie-mentor-semantic",
});

const historicalInputA = Object.freeze({
  creatorMessage: "The lighthouse keeper vanished.",
  context: { creatorConfirmedContext: [{ key: "location", value: "harbour" }] },
});
const tamperedInputB = Object.freeze({
  creatorMessage: "The lighthouse keeper vanished.",
  context: { creatorConfirmedContext: [{ key: "location", value: "tower" }] },
});

// The stored digest claims universe A, while the stored payload has silently become universe B.
// Recovery must independently recompute integrity before B reaches any local creative validator.
let reads = 0;
await assert.rejects(
  () => resolveHistoricalReconstructionInput({
    historical,
    currentInput: { creatorMessage: "TODAY-C" },
    readProviderOperation: async (providerCallId) => {
      reads += 1;
      assert.equal(providerCallId, historical.providerCallId);
      return Object.freeze({
        authorized: true,
        ...historical,
        reconstructionInputDigest: "71ae472623353a319e571b30a263a07e02a6659d725cdb5c8cbe15dc10995620",
        reconstructionInput: tamperedInputB,
      });
    },
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_INTEGRITY_INVALID",
  "a durable digest must be recomputed against the exact stored historical payload before recovery grants input authority",
);
assert.equal(reads, 1);

console.log("PASS — tampered historical provider input cannot wear an unrelated durable digest and gain recovery authority.");
console.log("LAW: A HISTORICAL INPUT DIGEST IS NOT DECORATION. RECOVERY AUTHORITY REQUIRES THE PAYLOAD TO REPRODUCE THE DURABLE DIGEST.");
