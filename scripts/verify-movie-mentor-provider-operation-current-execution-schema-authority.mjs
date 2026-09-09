import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";

const clone = value => value == null ? value : structuredClone(value);
const now = new Date("2035-01-01T00:00:00.000Z");

function executionStore(schema) {
  let durable = {
    domain: "iband.movie-mentor.inference-execution-store", schema,
    executionId: `execution-schema-${schema}`, creatorTurnId: `turn-schema-${schema}`,
    principalId: "creator-schema-court", projectId: "project-schema-court", reservationId: `reservation-schema-${schema}`,
    requestDigest: `digest-schema-${schema}`, phase: "active", ownerId: "owner-schema-court", leaseGeneration: 4,
    leaseReference: "lease-schema-court", fencingToken: "fence-schema-court",
    leaseAcquiredAt: "2034-12-31T23:50:00.000Z", leaseExpiresAt: "2035-01-01T00:10:00.000Z",
    maxProviderCalls: 2, providerCallsClaimed: 0, providerCalls: [],
  };
  return {
    async readExecution(id) { return durable.executionId === id ? clone(durable) : null; },
    async readExecutionByCreatorTurn(input = {}) { return input.creatorTurnId === durable.creatorTurnId && input.principalId === durable.principalId && input.projectId === durable.projectId ? clone(durable) : null; },
    async createExecution() { return null; }, async replaceExecution() { return null; },
    async claimProviderCall(input = {}) {
      if (schema !== 6) throw new Error("legacy schema must never reach durable provider-call claim");
      const call = { providerCallId: input.providerCallId, slotId: input.slotId, task: input.task, state: "admitted", leaseGeneration: input.leaseGeneration, leaseReference: input.leaseReference, fencingToken: input.fencingToken, admittedAt: input.admittedAt };
      durable = { ...durable, providerCallsClaimed: 1, providerCalls: [call] };
      return { claimed: true, execution: clone(durable), providerCall: clone(call) };
    },
  };
}

function operationModel() {
  let row = null;
  const query = value => ({ lean() { return this; }, async exec() { return clone(value); } });
  return {
    findOne(filter) { return query(row?.providerCallId === filter.providerCallId ? row : null); },
    async create(candidate) { row = clone(candidate); return clone(row); },
    updateOne() { return { async exec() { return { modifiedCount: 0 }; } }; },
  };
}

async function leaseCourt(schema) {
  const lease = createMovieMentorInferenceExecutionLeaseAuthority({ store: executionStore(schema), now: () => new Date(now), randomId: () => `schema-${schema}` });
  const execution = await lease.findExecutionByCreatorTurn({ creatorTurnId: `turn-schema-${schema}`, principalId: "creator-schema-court", projectId: "project-schema-court", requestDigest: `digest-schema-${schema}` });
  try { return { ok: true, providerCall: await lease.claimProviderCall({ execution, slotId: "semantic", task: "movie-mentor-semantic" }) }; }
  catch (error) { return { ok: false, error }; }
}

const legacy = await leaseCourt(5);
assert.equal(legacy.ok, false, "legacy execution history must fail before it can mint production provider-call authority");
assert.equal(legacy.error?.code, "MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_AUTHORITY_REQUIRED");

const current = await leaseCourt(6);
assert.equal(current.ok, true);
assert.equal(current.providerCall.dispatchAuthorized, true);

const routeFingerprint = crypto.createHash("sha256").update("generic-http|https://provider-operation-schema.example.test/v1/infer").digest("hex");
const operation = createMovieMentorProviderOperationAuthority({
  store: createMovieMentorProviderOperationMongoStore({ mongoModel: operationModel() }),
  now: () => new Date(now),
  resolveCurrentTarget: () => ({ provider: "generic-http", adapter: "generic-http", routeFingerprint, recoveryMode: "none" }),
  resolveCurrentModel: () => null,
});
const bound = await operation.bindOperation({ providerCall: current.providerCall });
assert.equal(bound.authorized, true, "current production-mintable provider-call authority must bind provider-operation identity");

console.log("GREEN: legacy execution history cannot mint the provider-call authority consumed by provider-operation binding.");
console.log("EXONERATION: provider-operation identity is historical metadata; provider-effect UNKNOWN is the forward-authority boundary and #89 independently owns current-schema proof.");
console.log("LAW: NO ASSUMED GAP — A COUNTERFEIT PROVIDER-CALL OBJECT IS NOT A PRODUCTION-REACHABLE AUTHORITY PATH.");
