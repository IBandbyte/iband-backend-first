import assert from "node:assert/strict";
import {
  createMovieMentorProviderOperationAuthority,
  digestMovieMentorProviderReconstructionInput,
} from "../ai/MovieMentorProviderOperationAuthority.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";

console.log("Movie Mentor provider operation input-integrity authority court");

const clone = (value) => (value === undefined ? undefined : structuredClone(value));
const inputA = Object.freeze({ universe: "BOUND-A", revision: 8, nested: { b: 2, a: 1 } });
const inputB = Object.freeze({ universe: "CORRUPTED-B", revision: 999, nested: { a: 1, b: 2 } });
const inputADigest = digestMovieMentorProviderReconstructionInput(inputA);

const providerCall = Object.freeze({
  authorized: true,
  dispatchAuthorized: true,
  providerCallId: "provider-call-operation-integrity",
  executionId: "execution-operation-integrity",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "worker-1",
  leaseGeneration: 1,
  leaseReference: "lease-1",
  fencingToken: "fence-1",
});

let record = null;
const store = {
  async readOperation(providerCallId) {
    assert.equal(providerCallId, providerCall.providerCallId);
    return clone(record);
  },
  async bindOperation(input) {
    if (!record) {
      record = {
        ...clone(input),
        reconstructionInputDigest: null,
        reconstructionInput: null,
        reconstructionInputBoundAt: null,
      };
    }
    return clone(record);
  },
  async bindReconstructionInput(input) {
    assert.equal(input.reconstructionInputDigest, inputADigest);
    record = {
      ...record,
      reconstructionInputDigest: input.reconstructionInputDigest,
      reconstructionInput: clone(inputB),
      reconstructionInputBoundAt: input.boundAt,
    };
    return clone(record);
  },
};

const authority = createMovieMentorProviderOperationAuthority({
  store,
  now: () => new Date("2032-01-01T00:00:00.000Z"),
  resolveCurrentTarget: () => describeCurrentMovieMentorProviderTarget({ env: {} }),
});

const integrityError = (error) => error?.code === "MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_INTEGRITY_INVALID";

await assert.rejects(
  () => authority.bindReconstructionInput({ providerCall, reconstructionInput: inputA }),
  integrityError,
  "durable ACK with digest A + payload B must not gain inputBound authority",
);

await assert.rejects(
  () => authority.readOperation(providerCall.providerCallId),
  integrityError,
  "readOperation must structurally fail closed instead of emitting authorized evidence for a mismatched reconstruction payload",
);

await assert.rejects(
  () => authority.assertCurrentTarget({ providerCall }),
  integrityError,
  "assertCurrentTarget must structurally fail closed instead of granting dispatch authority from a mismatched reconstruction payload",
);

console.log("✓ durable storage acknowledgement is evidence, not authority");
console.log("✓ digest A + payload B cannot become inputBound provider-operation evidence");
console.log("✓ corrupted durable history cannot be re-emitted as authorized operation evidence");
console.log("✓ corrupted durable history cannot contribute current provider dispatch authority");
console.log("LAW: DURABILITY MAY PRESERVE BYTES. ONLY VERIFIED BYTES MAY BECOME AUTHORITY.");
console.log("Movie Mentor provider operation input-integrity authority: GREEN");
