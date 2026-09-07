import assert from "node:assert/strict";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";
import { resolveHistoricalReconstructionInput } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";

console.log("Movie Mentor provider reconstruction-input integrity authority court");

const records = new Map();
const clone = (value) => (value === undefined ? undefined : structuredClone(value));
const store = {
  async readOperation(providerCallId) {
    return clone(records.get(providerCallId) || null);
  },
  async bindOperation(input) {
    const existing = records.get(input.providerCallId);
    if (existing) return clone(existing);
    const record = { ...clone(input), reconstructionInputDigest: null, reconstructionInput: null, reconstructionInputBoundAt: null };
    records.set(input.providerCallId, record);
    return clone(record);
  },
  async bindReconstructionInput(input) {
    const current = records.get(input.providerCallId);
    if (!current) return null;
    if (!current.reconstructionInputDigest) {
      current.reconstructionInputDigest = input.reconstructionInputDigest;
      current.reconstructionInput = clone(input.reconstructionInput);
      current.reconstructionInputBoundAt = input.boundAt;
      records.set(input.providerCallId, current);
    }
    return clone(current);
  },
};

const authority = createMovieMentorProviderOperationAuthority({
  store,
  now: () => new Date("2032-01-01T00:00:00.000Z"),
  resolveCurrentTarget: () => describeCurrentMovieMentorProviderTarget({ env: {} }),
});

const providerCall = Object.freeze({
  authorized: true,
  dispatchAuthorized: true,
  providerCallId: "provider-call-integrity",
  executionId: "execution-integrity",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "worker-1",
  leaseGeneration: 1,
  leaseReference: "lease-1",
  fencingToken: "fence-1",
});
const historical = Object.freeze({
  providerCallId: providerCall.providerCallId,
  executionId: providerCall.executionId,
  slotId: providerCall.slotId,
  task: providerCall.task,
});
const inputA = Object.freeze({ universe: "HISTORICAL-A", creatorStateRevision: 8, nested: { b: 2, a: 1 } });
const inputB = Object.freeze({ universe: "TAMPERED-B", creatorStateRevision: 999, nested: { a: 1, b: 2 } });

const bound = await authority.bindReconstructionInput({ providerCall, reconstructionInput: inputA });
assert.equal(bound.inputBound, true);
assert.match(bound.reconstructionInputDigest, /^[a-f0-9]{64}$/);
assert.deepEqual(bound.reconstructionInput, inputA);

const valid = await resolveHistoricalReconstructionInput({
  historical,
  currentInput: Object.freeze({ universe: "CURRENT-C" }),
  readProviderOperation: (providerCallId) => authority.readOperation(providerCallId),
});
assert.deepEqual(valid, inputA, "matching durable payload and digest must retain recovery input authority");

const legitimate = await authority.readOperation(providerCall.providerCallId);
const tamperedRead = Object.freeze({ ...legitimate, reconstructionInput: clone(inputB) });
await assert.rejects(
  () => resolveHistoricalReconstructionInput({
    historical,
    currentInput: Object.freeze({ universe: "CURRENT-C" }),
    readProviderOperation: async () => tamperedRead,
  }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_INTEGRITY_INVALID",
  "a legitimate recorded digest must not authorize a different historical payload",
);

console.log("✓ real provider-operation authority minted the historical input digest");
console.log("✓ matching historical payload remains recoverable");
console.log("✓ digest A + payload B is rejected before recovered-result reconstruction authority");
console.log("LAW: A STORED DIGEST IS NOT PROOF OF A STORED PAYLOAD UNTIL THAT PAYLOAD REPRODUCES THE DIGEST.");
console.log("Movie Mentor provider reconstruction-input integrity authority: GREEN");
