import assert from "node:assert/strict";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";

console.log("Movie Mentor reconstruction-input takeover serialization court");

const clone = value => value == null ? value : structuredClone(value);
const call = Object.freeze({
  providerCallId: "provider-call-takeover-window",
  executionId: "execution-takeover-window",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "worker-generation-1",
  leaseGeneration: 1,
  leaseReference: "lease-generation-1",
  fencingToken: "fence-generation-1",
});
let row = {
  domain: "iband.movie-mentor.provider-operation-reality",
  schema: 1,
  providerCallId: call.providerCallId,
  executionId: call.executionId,
  slotId: call.slotId,
  task: call.task,
  providerTarget: {
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "a".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  },
  providerModel: "gpt-test",
  boundAt: new Date("2037-01-01T00:00:00.000Z"),
  reconstructionInputDigest: null,
  reconstructionInput: null,
  reconstructionInputBoundAt: null,
};

let currentExecution = {
  schema: 6,
  phase: "active",
  executionId: call.executionId,
  ownerId: call.ownerId,
  leaseGeneration: call.leaseGeneration,
  leaseReference: call.leaseReference,
  fencingToken: call.fencingToken,
};
let takeoverOccurred = false;
let operationMutationCount = 0;

function query(value) {
  return { lean(){ return this; }, async exec(){ return clone(value); } };
}

const mongoModel = {
  collection: { async indexes(){ return [{ name: "providerCallId_1", key: { providerCallId: 1 }, unique: true }]; } },
  findOne(filter) {
    return query(filter.providerCallId === row.providerCallId ? row : null);
  },
  updateOne(filter, update) {
    return { async exec(){
      operationMutationCount += 1;
      const identityMatches = filter.providerCallId === row.providerCallId
        && filter.executionId === row.executionId
        && filter.slotId === row.slotId
        && filter.task === row.task;
      const inputUnbound = row.reconstructionInputDigest == null;
      if (identityMatches && inputUnbound) {
        row = { ...row, ...clone(update.$set) };
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    } };
  },
};

const executionCollection = {
  async updateOne(filter) {
    const admitted = filter.providerCalls?.$elemMatch || {};
    const exact = currentExecution.schema === filter.schema
      && currentExecution.phase === filter.phase
      && currentExecution.executionId === filter.executionId
      && currentExecution.ownerId === filter.ownerId
      && currentExecution.leaseGeneration === filter.leaseGeneration
      && currentExecution.leaseReference === filter.leaseReference
      && currentExecution.fencingToken === filter.fencingToken
      && admitted.providerCallId === call.providerCallId
      && admitted.slotId === call.slotId
      && admitted.task === call.task
      && admitted.leaseGeneration === call.leaseGeneration
      && admitted.leaseReference === call.leaseReference
      && admitted.fencingToken === call.fencingToken;
    if (!exact) return { matchedCount: 0, modifiedCount: 0 };

    // The current-generation proof succeeds, then ownership advances before
    // the immutable operation-input mutation. These writes must be one
    // serialization unit if the first bind is to carry current authority.
    currentExecution = {
      ...currentExecution,
      ownerId: "worker-generation-2",
      leaseGeneration: 2,
      leaseReference: "lease-generation-2",
      fencingToken: "fence-generation-2",
    };
    takeoverOccurred = true;
    return { matchedCount: 1, modifiedCount: 1 };
  },
};

const store = createMovieMentorProviderOperationMongoStore({ mongoModel, executionCollection });
const staleInput = Object.freeze({ universe: "generation-1-input", revision: 1 });

await assert.rejects(
  () => store.bindReconstructionInput({
    ...call,
    reconstructionInputDigest: "digest-generation-1",
    reconstructionInput: staleInput,
    boundAt: "2037-01-01T00:00:01.000Z",
  }),
  error => error?.code === "MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_EXECUTION_FENCED",
  "a writer whose execution authority is superseded between proof and immutable input mutation must not first-bind recovery input",
);

assert.equal(takeoverOccurred, true, "court must place takeover after current-fence proof");
assert.equal(operationMutationCount, 0, "superseded writer must never reach immutable operation-input mutation");
assert.equal(row.reconstructionInputDigest, null, "superseded generation must author no durable recovery-input identity");
assert.equal(row.reconstructionInput, null);

console.log("✓ current execution proof and immutable reconstruction-input first-bind serialize as one authority decision");
console.log("✓ takeover between proof and operation mutation grants the superseded generation zero durable recovery-input authorship");
console.log("LAW: FIRST RECONSTRUCTION-INPUT BIND MAY NOT BORROW A CURRENT-LEASE PROOF ACROSS A TAKEOVER WINDOW.");
console.log("Movie Mentor reconstruction-input takeover serialization court: GREEN");
