import assert from "node:assert/strict";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";

console.log("Movie Mentor provider reconstruction-input store CAS authority court");

const clone = value => value == null ? value : structuredClone(value);
const call = Object.freeze({
  providerCallId: "provider-call-reconstruction-cas",
  executionId: "execution-reconstruction-cas",
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
const target = Object.freeze({ provider: "openai", adapter: "openai-responses", routeFingerprint: "route-cas", recoveryMode: "known-response-id-retrieval" });
let row = {
  domain: "iband.movie-mentor.provider-operation-reality",
  schema: 1,
  ...call,
  providerTarget: target,
  providerModel: "gpt-test",
  boundAt: new Date("2033-01-01T00:00:00.000Z"),
  reconstructionInputDigest: null,
  reconstructionInput: null,
  reconstructionInputBoundAt: null,
};
let releaseFirst;
const firstPaused = new Promise(resolve => { releaseFirst = resolve; });
let firstEntered;
const firstAtMutation = new Promise(resolve => { firstEntered = resolve; });
let mutationCount = 0;

function query(value) {
  return { lean(){ return this; }, async exec(){ return clone(value); } };
}

const mongoModel = {
  collection: { async indexes(){ return [{ name: "providerCallId_1", key: { providerCallId: 1 }, unique: true }]; } },
  findOne(filter) {
    if (filter.providerCallId !== row.providerCallId) return query(null);
    return query(row);
  },
  updateOne(filter, update) {
    return { async exec(){
      mutationCount += 1;
      if (mutationCount === 1) {
        firstEntered();
        await firstPaused;
      }
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

const store = createMovieMentorProviderOperationMongoStore({ mongoModel });
const inputA = Object.freeze({ universe: "A", revision: 1 });
const inputB = Object.freeze({ universe: "B", revision: 2 });
const bindA = store.bindReconstructionInput({ ...call, reconstructionInputDigest: "digest-A", reconstructionInput: inputA, boundAt: "2033-01-01T00:00:01.000Z" });
await firstAtMutation;
const bindB = store.bindReconstructionInput({ ...call, reconstructionInputDigest: "digest-B", reconstructionInput: inputB, boundAt: "2033-01-01T00:00:02.000Z" });
const winnerB = await bindB;
releaseFirst();
const loserA = await bindA;

assert.equal(winnerB.reconstructionInputDigest, "digest-B", "the successful CAS writer must observe its own durable reconstruction-input identity");
assert.equal(loserA.reconstructionInputDigest, "digest-B", "the losing CAS writer must observe the winner, never fabricate its requested digest");
assert.deepEqual(loserA.reconstructionInput, inputB, "the losing writer must return the immutable winning payload");
assert.equal(row.reconstructionInputDigest, "digest-B");
assert.deepEqual(row.reconstructionInput, inputB);
assert.equal(mutationCount, 2, "court must exercise two concurrent first-bind attempts");

console.log("✓ concurrent first-bind attempts converge on one durable reconstruction-input identity");
console.log("✓ losing CAS writer observes the immutable winner and cannot overwrite it");
console.log("LAW: ONE PROVIDER OPERATION MAY ACQUIRE EXACTLY ONE DURABLE RECONSTRUCTION INPUT.");
console.log("Movie Mentor provider reconstruction-input store CAS authority: GREEN");
