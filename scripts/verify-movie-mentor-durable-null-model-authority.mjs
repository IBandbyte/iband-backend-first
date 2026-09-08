import assert from "node:assert/strict";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";

console.log("Movie Mentor durable null-model authority court");

const providerTarget = Object.freeze({
  provider: "generic-http",
  adapter: "generic-http",
  routeFingerprint: "d".repeat(64),
  recoveryMode: "none",
});

const baseRow = Object.freeze({
  domain: "iband.movie-mentor.provider-operation-reality",
  schema: 1,
  providerCallId: "provider-call-durable-null-model",
  executionId: "execution-durable-null-model",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  providerTarget,
  boundAt: "2036-01-01T00:00:00.000Z",
  reconstructionInputDigest: null,
  reconstructionInput: null,
  reconstructionInputBoundAt: null,
});

const providerCall = Object.freeze({
  dispatchAuthorized: true,
  providerCallId: baseRow.providerCallId,
  executionId: baseRow.executionId,
  slotId: baseRow.slotId,
  task: baseRow.task,
  ownerId: "owner-durable-null-model",
  leaseGeneration: 1,
  leaseReference: "lease-durable-null-model",
  fencingToken: "fence-durable-null-model",
});

function mongoModelFor(row) {
  return {
    findOne() {
      return {
        lean() {
          return {
            async exec() {
              return structuredClone(row);
            },
          };
        },
      };
    },
  };
}

const missingModelStore = createMovieMentorProviderOperationMongoStore({
  mongoModel: mongoModelFor(baseRow),
});

await assert.rejects(
  () => missingModelStore.readOperation(baseRow.providerCallId),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_OPERATION_MODEL_AUTHORITY_ABSENT",
  "Mongo normalization must reject a durable provider operation with no providerModel field instead of manufacturing null authority",
);

const rawMissingModelAuthority = createMovieMentorProviderOperationAuthority({
  store: {
    async readOperation() { return structuredClone(baseRow); },
    async bindOperation() { return structuredClone(baseRow); },
  },
  resolveCurrentTarget: () => providerTarget,
  resolveCurrentModel: () => null,
});
await assert.rejects(
  () => rawMissingModelAuthority.assertCurrentTarget({ providerCall }),
  (error) => error?.code === "MOVIE_MENTOR_PROVIDER_OPERATION_MODEL_AUTHORITY_ABSENT",
  "provider-operation authority must independently reject missing durable model proof instead of borrowing the store's normalization guarantee",
);

const explicitNullStore = createMovieMentorProviderOperationMongoStore({
  mongoModel: mongoModelFor({ ...baseRow, providerModel: null }),
});
const explicitNull = await explicitNullStore.readOperation(baseRow.providerCallId);
assert.ok(Object.prototype.hasOwnProperty.call(explicitNull, "providerModel"));
assert.equal(explicitNull.providerModel, null, "an explicitly persisted null model remains legitimate generic-http model authority");

const operationAuthority = createMovieMentorProviderOperationAuthority({
  store: explicitNullStore,
  resolveCurrentTarget: () => providerTarget,
  resolveCurrentModel: () => null,
});
const current = await operationAuthority.assertCurrentTarget({ providerCall });
assert.equal(current.dispatchAuthorized, true);
assert.equal(current.currentModelVerified, true);
assert.ok(Object.prototype.hasOwnProperty.call(current, "providerModel"));
assert.equal(current.providerModel, null);
assert.ok(Object.prototype.hasOwnProperty.call(current.providerTarget, "dispatchModel"));
assert.equal(current.providerTarget.dispatchModel, null);

console.log("✓ Mongo durable boundary rejects missing model authority");
console.log("✓ provider-operation authority independently rejects missing model authority");
console.log("✓ explicitly persisted null remains valid generic-http model authority");
console.log("LAW: NULL MAY BE AUTHORITY ONLY WHEN NULL ITSELF CROSSED THE DURABLE BOUNDARY. MISSING PROOF MAY NOT BE NORMALIZED INTO NULL.");
console.log("Movie Mentor durable null-model authority gate: GREEN");
