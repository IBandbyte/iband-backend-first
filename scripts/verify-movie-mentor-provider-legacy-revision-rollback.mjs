import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";

console.log("Movie Mentor provider legacy revision rollback verifier");

const clone = value => value == null ? value : structuredClone(value);
const indexes = [{ key: { providerCallId: 1 }, unique: true }];
const executionIndexes = [{ key: { executionId: 1 }, unique: true }];

let effectRow = {
  domain: "iband.movie-mentor.provider-effect-reality",
  schema: 1,
  providerCallId: "call-legacy-revision-rollback",
  executionId: "execution-legacy-revision-rollback",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  state: "unknown",
  dispatchUnknownAt: new Date("2035-01-01T00:00:00.000Z"),
  evidence: [],
};
const before = clone(effectRow);
let migrationWrites = 0;
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
  collection: { async indexes() { return indexes; } },
  findOne(filter) {
    if (filter?.providerCallId && filter.providerCallId !== effectRow?.providerCallId) return query(null);
    return query(effectRow);
  },
  findOneAndUpdate(filter, update) {
    if (filter?.$or) {
      const legacy = effectRow && (effectRow.revision === null || effectRow.revision === undefined);
      if (!legacy) return query(null);
      migrationWrites += 1;
      effectRow = { ...effectRow, revision: update.$set.revision };
      return query(effectRow);
    }
    if (!effectRow || filter?.revision !== effectRow.revision) return query(null);
    evidenceWrites += 1;
    const pushed = clone(update.$push.evidence);
    effectRow = {
      ...effectRow,
      evidence: [...effectRow.evidence, pushed],
      state: update.$set.state,
      revision: effectRow.revision + update.$inc.revision,
    };
    return query(effectRow);
  },
};

const executionCollection = {
  async indexes() { return executionIndexes; },
  async updateOne() {
    executionTouches += 1;
    return { matchedCount: 0 };
  },
};

const startSession = async () => ({
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
});

const previous = mongoose.models.MovieMentorProviderEffectReality;
mongoose.models.MovieMentorProviderEffectReality = fakeModel;
try {
  const store = createMovieMentorProviderEffectMongoStore({
    startSession,
    executionCollection,
    readPhysicalIndexes: async collection => collection === "movie_mentor_provider_effect_reality" ? indexes : executionIndexes,
  });

  let error = null;
  try {
    await store.appendEvidence({
      providerCallId: "call-legacy-revision-rollback",
      externalEffectId: "response-legacy-revision-rollback",
      provider: "test-provider",
      observedAt: "2035-01-01T00:00:01.000Z",
      source: "provider-response",
    });
  } catch (value) {
    error = value;
  }

  assert.ok(error, "later execution touch loss must abort the transaction");
  assert.equal(error.code, "MOVIE_MENTOR_PROVIDER_EFFECT_EXECUTION_MISSING");
  assert.equal(migrationWrites, 1, "legacy revision migration must genuinely occur before the forced later failure");
  assert.equal(evidenceWrites, 1, "evidence mutation must genuinely occur after migration and before the forced later failure");
  assert.equal(executionTouches, 1, "execution touch must be attempted once");
  assert.deepEqual(effectRow, before, "transaction rollback must restore the complete pre-migration provider-effect row");
  assert.equal(Object.hasOwn(effectRow, "revision"), false, "rolled-back legacy row must not retain a migrated revision");
  assert.equal(effectRow.evidence.length, 0, "rolled-back legacy row must not retain appended evidence");
  assert.equal(effectRow.state, "unknown", "rolled-back legacy row must remain UNKNOWN");
  assert.equal(sessionsEnded, 1, "transaction session must be ended exactly once");

  console.log("GREEN: legacy provider-effect revision migration and evidence mutation roll back when the later execution touch fails.");
} finally {
  if (previous) mongoose.models.MovieMentorProviderEffectReality = previous;
  else delete mongoose.models.MovieMentorProviderEffectReality;
}
