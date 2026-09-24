import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";

const clone = value => value == null ? value : structuredClone(value);
function query(result) {
  return { session() { return this; }, lean() { return this; }, async exec() { return clone(result); } };
}

let operationRow = null;
const fakeModel = {
  collection: { async indexes() { return [{ name: "providerCallId_1", key: { providerCallId: 1 }, unique: true }]; } },
  findOne(filter) { return query(operationRow?.providerCallId === filter.providerCallId ? operationRow : null); },
  async create(rows) { operationRow = clone(rows[0]); return [clone(operationRow)]; },
};

const historicalCall = Object.freeze({
  providerCallId: "provider-call-generation-one",
  executionId: "execution-operation-mint-lease",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "worker-generation-one",
  leaseGeneration: 1,
  leaseReference: "lease-generation-one",
  fencingToken: "fence-generation-one",
  providerTarget: Object.freeze({
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: "a".repeat(64),
    recoveryMode: "known-response-id-retrieval",
  }),
  providerModel: "gpt-operation-mint-lease-proof",
  boundAt: "2036-01-01T00:01:01.000Z",
});

const execution = {
  executionId: historicalCall.executionId,
  schema: 6,
  phase: "active",
  ownerId: "worker-generation-two",
  leaseGeneration: 2,
  leaseReference: "lease-generation-two",
  fencingToken: "fence-generation-two",
  leaseExpiresAt: "2036-01-01T00:10:00.000Z",
  providerCallsClaimed: 1,
  providerCalls: [{
    providerCallId: historicalCall.providerCallId,
    slotId: historicalCall.slotId,
    task: historicalCall.task,
    leaseGeneration: historicalCall.leaseGeneration,
    leaseReference: historicalCall.leaseReference,
    fencingToken: historicalCall.fencingToken,
  }],
  settlementRealityBarrierRevision: 0,
};

let touches = 0;
const executionCollection = {
  async updateOne(filter) {
    const expected = filter.providerCalls?.$elemMatch;
    const admitted = execution.providerCalls.find(call =>
      call.providerCallId === expected?.providerCallId &&
      call.slotId === expected?.slotId &&
      call.task === expected?.task
    );
    const matches = execution.executionId === filter.executionId &&
      execution.schema === filter.schema &&
      execution.phase === filter.phase &&
      admitted;
    if (matches) {
      touches += 1;
      execution.settlementRealityBarrierRevision += 1;
    }
    return { matchedCount: matches ? 1 : 0, modifiedCount: matches ? 1 : 0 };
  },
};

const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
const previous = mongoose.models.MovieMentorProviderOperationReality;
mongoose.models.MovieMentorProviderOperationReality = fakeModel;

try {
  const store = createMovieMentorProviderOperationMongoStore({
    connect: async () => {},
    startSession: async () => session,
    executionCollection,
    readPhysicalIndexes: async () => [{ name: "providerCallId_1", key: { providerCallId: 1 }, unique: true }],
  });

  await assert.rejects(
    () => store.bindOperation(historicalCall),
    error => error?.code === "MOVIE_MENTOR_PROVIDER_OPERATION_EXECUTION_FENCED",
    "first durable provider-operation mint must fail once the admitting lease generation has been superseded",
  );
  assert.equal(operationRow, null, "stale generation may create zero new durable provider-operation reality");
  assert.equal(touches, 0, "stale generation may receive zero execution serialization credit");

  console.log("GREEN: superseded provider-call lease generation cannot mint first durable provider-operation reality.");
  console.log("LAW: HISTORICAL PROVIDER OPERATION MAY SURVIVE TAKEOVER ONLY IF IT WAS DURABLY MINTED WHILE ITS ADMITTING LEASE/FENCE WAS CURRENT.");
} finally {
  if (previous) mongoose.models.MovieMentorProviderOperationReality = previous;
  else delete mongoose.models.MovieMentorProviderOperationReality;
}
