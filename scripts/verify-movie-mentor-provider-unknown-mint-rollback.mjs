import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";

let executionRevision = 14;
let executionTouches = 0;
let createAttempts = 0;
let sessionsEnded = 0;

function query(value = null) {
  return {
    session() { return this; },
    lean() { return this; },
    async exec() { return value; },
  };
}

const fakeModel = {
  collection: {
    async indexes() {
      return [{ name: "providerCallId_1", key: { providerCallId: 1 }, unique: true }];
    },
  },
  findOne() { return query(null); },
  async create() {
    createAttempts += 1;
    const error = new Error("forced provider-effect UNKNOWN mint failure");
    error.code = "TEST_PROVIDER_EFFECT_MINT_FAILURE";
    throw error;
  },
};

const executionCollection = {
  async indexes() {
    return [{ name: "executionId_1", key: { executionId: 1 }, unique: true }];
  },
  async updateOne() {
    executionTouches += 1;
    executionRevision += 1;
    return { matchedCount: 1, modifiedCount: 1 };
  },
};

const session = {
  async withTransaction(fn) {
    const beforeRevision = executionRevision;
    try {
      return await fn();
    } catch (error) {
      executionRevision = beforeRevision;
      throw error;
    }
  },
  async endSession() { sessionsEnded += 1; },
};

const previous = mongoose.models.MovieMentorProviderEffectReality;
mongoose.models.MovieMentorProviderEffectReality = fakeModel;

try {
  const store = createMovieMentorProviderEffectMongoStore({
    connect: async () => {},
    executionCollection,
    startSession: async () => session,
  });

  await assert.rejects(
    () => store.beginUnknown({
      providerCallId: "call-unknown-rollback",
      executionId: "execution-unknown-rollback",
      slotId: "semantic",
      task: "movie-mentor-semantic",
      dispatchUnknownAt: "2035-01-01T00:00:00.000Z",
      ownerId: "owner-unknown-rollback",
      leaseGeneration: 4,
      leaseReference: "lease-unknown-rollback",
      fencingToken: "fence-unknown-rollback",
    }),
    error => error?.code === "TEST_PROVIDER_EFFECT_MINT_FAILURE",
    "UNKNOWN mint failure must escape the transaction",
  );

  assert.equal(executionTouches, 1, "execution reality revision must genuinely advance before the forced UNKNOWN mint failure");
  assert.equal(createAttempts, 1, "provider-effect UNKNOWN mint must genuinely be attempted after the execution touch");
  assert.equal(executionRevision, 14, "transaction abort must restore the execution provider-effect reality revision");
  assert.equal(sessionsEnded, 1, "transaction session must always be ended");

  console.log("GREEN: execution reality revision is rolled back when provider-effect UNKNOWN mint fails in the same transaction.");
} finally {
  if (previous) mongoose.models.MovieMentorProviderEffectReality = previous;
  else delete mongoose.models.MovieMentorProviderEffectReality;
}
