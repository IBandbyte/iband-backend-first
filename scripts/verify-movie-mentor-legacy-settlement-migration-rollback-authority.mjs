import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor legacy settlement migration rollback authority court");

const clone = value => value == null ? value : structuredClone(value);
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stableDigest = value => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const executionId = "execution-legacy-rollback";
const creatorTurnId = "turn-legacy-rollback";
const principalId = "creator-legacy-rollback";
const projectId = "project-legacy-rollback";
const reservationId = "reservation-legacy-rollback";
const requestDigest = "request-legacy-rollback";
const closureReference = "closure-legacy-rollback";
const resultReference = "result-legacy-rollback";
const candidateReference = "candidate-legacy-rollback";
const resultPayload = { response: { message: "legacy rollback" }, metadata: { agent: "mentor" } };
const resultDigest = stableDigest(resultPayload);
const frozenProviderCallSetDigest = digest([]);
const closurePolicyVersion = "policy-legacy-rollback";
const closureCertificateDigest = digest({
  executionId,
  creatorTurnId,
  principalId,
  projectId,
  reservationId,
  requestDigest,
  closureReference,
  frozenProviderCallSetDigest,
  closurePolicyVersion,
  realities: [],
});

let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store",
  schema: 6,
  phase: "finalized",
  executionId,
  creatorTurnId,
  principalId,
  projectId,
  reservationId,
  requestDigest,
  leaseGeneration: 7,
  leaseReference: "lease-legacy-rollback",
  fencingToken: "fence-legacy-rollback",
  providerCallsClaimed: 0,
  providerCalls: [],
  frozenProviderCallCount: 0,
  frozenProviderCallSetDigest,
  closurePolicyVersion,
  closureReference,
  closureCertificateDigest,
  providerEffectRealityRevision: 23,
  resultFinalizationBarrierRevision: 4,
  settlementRealityBarrierRevision: 9,
  finalizedResultReference: resultReference,
  finalizedCandidateReference: candidateReference,
  finalizedResultDigest: resultDigest,
  resultFinalizedAt: "2036-01-01T00:00:00.000Z",
};

const resultRow = {
  domain: "iband.movie-mentor.canonical-result-store",
  schema: 2,
  resultReference,
  candidateReference,
  executionId,
  creatorTurnId,
  principalId,
  projectId,
  reservationId,
  requestDigest,
  closureReference,
  closureCertificateDigest,
  resultDigest,
  resultPayload: stable(resultPayload),
};

const candidateRow = {
  domain: "iband.movie-mentor.result-candidate-store",
  schema: 2,
  candidateReference,
  executionId,
  creatorTurnId,
  principalId,
  projectId,
  reservationId,
  requestDigest,
  resultDigest,
  resultPayload: stable(resultPayload),
  stagedFromLeaseGeneration: 7,
  stagedFromLeaseReference: "lease-legacy-rollback",
  stagedFromFencingToken: "fence-legacy-rollback",
  creatorStateRevision: 8,
  creatorStateGeneration: 3,
  creatorStateFingerprint: "state-fingerprint-legacy-rollback",
  creatorStateOwnershipRef: "ownership-legacy-rollback",
  creatorStateOwnershipRevision: 5,
  stagedAt: "2035-12-31T23:59:59.000Z",
};

let reservationRow = {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  reservationId,
  principalId,
  projectId,
  operation: "movie-mentor-turn",
  units: 1,
  status: "consumed",
  settledAt: "2036-01-01T00:00:01.000Z",
  settlementReason: `canonical-result:${resultReference}`,
};

let reservationBackfills = 0;
let executionBarriers = 0;
let entitlementMutations = 0;
let sessionsEnded = 0;

const collections = {
  movie_mentor_inference_execution: {
    async findOne() { return clone(executionRow); },
    async updateOne(filter) {
      executionBarriers += 1;
      assert.equal(filter.executionId, executionId);
      assert.equal(filter.phase, "finalized");
      assert.equal(filter.providerEffectRealityRevision, 23);
      assert.equal(filter.finalizedResultReference, resultReference);
      assert.equal(filter.finalizedCandidateReference, candidateReference);
      assert.equal(filter.finalizedResultDigest, resultDigest);
      return { matchedCount: 0, modifiedCount: 0 };
    },
  },
  movie_mentor_canonical_result: {
    async findOne() { return clone(resultRow); },
  },
  movie_mentor_result_candidate: {
    async findOne() { return clone(candidateRow); },
  },
  movie_mentor_provider_effect_reality: {
    find() { return { async toArray() { return []; } }; },
  },
  movie_mentor_inference_spend_reservation: {
    async findOne() { return clone(reservationRow); },
    async updateOne(filter, update) {
      reservationBackfills += 1;
      assert.equal(filter.reservationId, reservationId);
      assert.equal(filter.status, "consumed");
      assert.equal(filter.settlementReason, `canonical-result:${resultReference}`);
      Object.assign(reservationRow, clone(update.$set));
      return { matchedCount: 1, modifiedCount: 1 };
    },
  },
  movie_mentor_inference_entitlement: {
    async findOneAndUpdate() {
      entitlementMutations += 1;
      throw new Error("legacy migration must never debit entitlement");
    },
  },
};

const database = {
  collection(name) {
    const collection = collections[name];
    assert.ok(collection, `unexpected collection: ${name}`);
    return collection;
  },
};

const startSession = async () => ({
  async withTransaction(fn) {
    const beforeReservation = clone(reservationRow);
    const beforeExecution = clone(executionRow);
    try {
      return await fn();
    } catch (error) {
      reservationRow = beforeReservation;
      executionRow = beforeExecution;
      throw error;
    }
  },
  async endSession() { sessionsEnded += 1; },
});

const store = createMovieMentorInferenceSettlementMongoStore({
  connect: async () => {},
  startSession,
  db: () => database,
});

let failure = null;
try {
  await store.settleCanonicalResult({ executionId });
} catch (error) {
  failure = error;
}

assert.ok(failure, "lost legacy migration barrier must fail closed");
assert.equal(failure.code, "MOVIE_MENTOR_INFERENCE_SETTLEMENT_REALITY_RACE");
assert.equal(failure.retryable, true);
assert.equal(reservationBackfills, 1, "court must prove the legacy reservation backfill succeeded before barrier loss");
assert.equal(executionBarriers, 1, "court must reach the FINALIZED→SETTLED execution barrier");
assert.equal(entitlementMutations, 0, "legacy proof migration must grant no new entitlement debit authority");
assert.equal(reservationRow.status, "consumed");
assert.equal(reservationRow.settlementReason, `canonical-result:${resultReference}`);
assert.equal(reservationRow.settlementExecutionId, undefined, "aborted transaction must roll back new settlement execution lineage");
assert.equal(reservationRow.settlementResultReference, undefined, "aborted transaction must roll back new settlement result lineage");
assert.equal(reservationRow.settlementCandidateReference, undefined, "aborted transaction must roll back new settlement candidate lineage");
assert.equal(reservationRow.settlementResultDigest, undefined, "aborted transaction must roll back new settlement digest lineage");
assert.equal(executionRow.phase, "finalized", "lost migration barrier must not advance execution to SETTLED");
assert.equal(executionRow.settlementRealityBarrierRevision, 9, "lost migration barrier must not increment settlement reality authority");
assert.equal(executionRow.settledResultReference, undefined);
assert.equal(executionRow.settledCandidateReference, undefined);
assert.equal(executionRow.settledResultDigest, undefined);
assert.equal(executionRow.settledAt, undefined);
assert.equal(sessionsEnded, 1, "failed migration transaction must close its session");

console.log("✓ legacy consumed-reservation lineage backfill is reached and succeeds inside the transaction");
console.log("✓ forced FINALIZED→SETTLED barrier loss throws MOVIE_MENTOR_INFERENCE_SETTLEMENT_REALITY_RACE");
console.log("✓ transaction rollback removes all newly backfilled settlement lineage");
console.log("✓ execution remains FINALIZED, settlement barrier revision is unchanged, and no entitlement debit occurs");
console.log("LAW: A LEGACY PROOF BACKFILL THAT LOSES ITS EXECUTION BARRIER ACQUIRES ZERO NEW SETTLEMENT AUTHORITY.");
console.log("Movie Mentor legacy settlement migration rollback authority: GREEN");
