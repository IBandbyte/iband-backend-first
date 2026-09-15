import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";

const clone = value => value == null ? value : structuredClone(value);

let effectRow = {
  domain: "iband.movie-mentor.provider-effect-reality",
  schema: 2,
  providerCallId: "call-evidence-rollback",
  executionId: "execution-evidence-rollback",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  state: "unknown",
  dispatchUnknownAt: new Date("2035-01-01T00:00:00.000Z"),
  revision: 0,
  evidence: [],
};

const beforeEffect = clone(effectRow);
let evidenceWrites = 0;
let executionTouches = 0;
let sessionsEnded = 0;

function query(value) {
  return {
    session() { return this; },
    lean() { return this; },
    async exec() { return clone(value); },
  };
}

const fakeModel = {
  collection: {
    async indexes() {
      return [{ name: "providerCallId_1", key: { providerCallId: 1 }, unique: true }];
    },
  },
  findOne(filter) {
    return query(filter.providerCallId === effectRow.providerCallId ? effectRow : null);
  },
  find() { return query([]); },
  findOneAndUpdate(filter, update) {
    const matches = filter.providerCallId === effectRow.providerCallId &&
      filter.revision === effectRow.revision &&
      !effectRow.evidence.some(item => item.externalEffectId === "response-evidence-rollback");
    if (!matches) return query(null);
    evidenceWrites += 1;
    effectRow = {
      ...effectRow,
      state: update.$set.state,
      revision: effectRow.revision + update.$inc.revision,
      evidence: [...effectRow.evidence, clone(update.$push.evidence)],
    };
    return query(effectRow);
  },
};

const executionCollection = {
  async indexes() {
    return [{ name: "executionId_1", key: { executionId: 1 }, unique: true }];
  },
  async updateOne() {
    executionTouches += 1;
    return { matchedCount: 0, modifiedCount: 0 };
  },
};

const session = {
  async withTransaction(fn) {
    const snapshot = clone(effectRow);
    try {
      return await fn();
    } catch (error) {
      effectRow = snapshot;
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
    () => store.appendEvidence({
      providerCallId: "call-evidence-rollback",
      externalEffectId: "response-evidence-rollback",
      provider: "test-provider",
      observedAt: "2035-01-01T00:00:01.000Z",
      source: "provider-response",
    }),
    error => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_EXECUTION_MISSING",
    "provider evidence must fail when its execution ledger can no longer be touched",
  );

  assert.equal(evidenceWrites, 1, "provider evidence CAS must genuinely succeed before the forced execution-ledger failure");
  assert.equal(executionTouches, 1, "execution reality revision must be attempted after provider evidence mutation");
  assert.deepEqual(effectRow, beforeEffect, "transaction abort must restore provider-effect evidence, state, and revision");
  assert.equal(sessionsEnded, 1, "transaction session must always be ended");

  console.log("GREEN: provider evidence mutation is rolled back when the execution-ledger touch fails in the same transaction.");
} finally {
  if (previous) mongoose.models.MovieMentorProviderEffectReality = previous;
  else delete mongoose.models.MovieMentorProviderEffectReality;
}
