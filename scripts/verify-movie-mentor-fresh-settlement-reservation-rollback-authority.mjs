import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor fresh settlement reservation rollback authority court");

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

const executionId = "execution-fresh-rollback";
const creatorTurnId = "turn-fresh-rollback";
const principalId = "creator-fresh-rollback";
const projectId = "project-fresh-rollback";
const reservationId = "reservation-fresh-rollback";
const requestDigest = "request-fresh-rollback";
const closureReference = "closure-fresh-rollback";
const resultReference = "result-fresh-rollback";
const candidateReference = "candidate-fresh-rollback";
const resultPayload = { response: { message: "fresh rollback" }, metadata: { agent: "mentor" } };
const resultDigest = stableDigest(resultPayload);
const frozenProviderCallSetDigest = digest([]);
const closurePolicyVersion = "policy-fresh-rollback";
const closureCertificateDigest = digest({ executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest, closureReference, frozenProviderCallSetDigest, closurePolicyVersion, realities: [] });

let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store", schema: 6, phase: "finalized",
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest,
  leaseGeneration: 7, leaseReference: "lease-fresh-rollback", fencingToken: "fence-fresh-rollback",
  providerCallsClaimed: 0, providerCalls: [], frozenProviderCallCount: 0, frozenProviderCallSetDigest,
  closurePolicyVersion, closureReference, closureCertificateDigest, providerEffectRealityRevision: 23,
  resultFinalizationBarrierRevision: 4, settlementRealityBarrierRevision: 9,
  finalizedResultReference: resultReference, finalizedCandidateReference: candidateReference,
  finalizedResultDigest: resultDigest, resultFinalizedAt: "2036-01-01T00:00:00.000Z",
};
const resultRow = {
  domain: "iband.movie-mentor.canonical-result-store", schema: 2, resultReference, candidateReference,
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest, closureReference,
  closureCertificateDigest, resultDigest, resultPayload: stable(resultPayload),
};
const candidateRow = {
  domain: "iband.movie-mentor.result-candidate-store", schema: 2, candidateReference,
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest, resultDigest,
  resultPayload: stable(resultPayload), stagedFromLeaseGeneration: 7,
  stagedFromLeaseReference: "lease-fresh-rollback", stagedFromFencingToken: "fence-fresh-rollback",
  creatorStateRevision: 8, creatorStateGeneration: 3, creatorStateFingerprint: "state-fingerprint-fresh-rollback",
  creatorStateOwnershipRef: "ownership-fresh-rollback", creatorStateOwnershipRevision: 5,
  stagedAt: "2035-12-31T23:59:59.000Z",
};
let reservationRow = {
  domain: "iband.movie-mentor.inference-spend", schema: 1, reservationId, principalId, projectId,
  operation: "movie-mentor-turn", units: 2, status: "reserved",
};
let entitlementRow = {
  domain: "iband.movie-mentor.inference-spend", schema: 1, principalId,
  reservedUnits: 5, consumedUnits: 11, entitlementRevision: 17,
};

let executionBarriers = 0;
let entitlementDebits = 0;
let reservationConsumes = 0;
let sessionsEnded = 0;

const collections = {
  movie_mentor_inference_execution: {
    async findOne() { return clone(executionRow); },
    async updateOne(filter, update) {
      executionBarriers += 1;
      assert.equal(filter.executionId, executionId);
      assert.equal(filter.phase, "finalized");
      assert.equal(filter.providerEffectRealityRevision, 23);
      Object.assign(executionRow, clone(update.$set));
      executionRow.settlementRealityBarrierRevision += update.$inc.settlementRealityBarrierRevision;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  },
  movie_mentor_canonical_result: { async findOne() { return clone(resultRow); } },
  movie_mentor_result_candidate: { async findOne() { return clone(candidateRow); } },
  movie_mentor_provider_effect_reality: { find() { return { async toArray() { return []; } }; } },
  movie_mentor_inference_entitlement: {
    async findOneAndUpdate(filter, update) {
      entitlementDebits += 1;
      assert.equal(filter.principalId, principalId);
      assert.equal(filter.domain, "iband.movie-mentor.inference-spend");
      assert.equal(filter.schema, 1);
      assert.equal(filter.reservedUnits.$gte, 2);
      entitlementRow.reservedUnits += update.$inc.reservedUnits;
      entitlementRow.consumedUnits += update.$inc.consumedUnits;
      entitlementRow.entitlementRevision += update.$inc.entitlementRevision;
      return clone(entitlementRow);
    },
  },
  movie_mentor_inference_spend_reservation: {
    async findOne() { return clone(reservationRow); },
    async findOneAndUpdate(filter) {
      reservationConsumes += 1;
      assert.equal(filter.reservationId, reservationId);
      assert.equal(filter.status, "reserved");
      return null;
    },
  },
};
const database = { collection(name) { const collection = collections[name]; assert.ok(collection, `unexpected collection: ${name}`); return collection; } };
const startSession = async () => ({
  async withTransaction(fn) {
    const beforeExecution = clone(executionRow);
    const beforeReservation = clone(reservationRow);
    const beforeEntitlement = clone(entitlementRow);
    try { return await fn(); }
    catch (error) {
      executionRow = beforeExecution;
      reservationRow = beforeReservation;
      entitlementRow = beforeEntitlement;
      throw error;
    }
  },
  async endSession() { sessionsEnded += 1; },
});
const store = createMovieMentorInferenceSettlementMongoStore({ connect: async () => {}, startSession, db: () => database, now: () => new Date("2036-01-01T00:00:02.000Z") });

let failure = null;
try { await store.settleCanonicalResult({ executionId }); } catch (error) { failure = error; }

assert.ok(failure, "lost fresh reservation consume must fail closed");
assert.equal(failure.code, "MOVIE_MENTOR_INFERENCE_SETTLEMENT_RESERVATION_RACE");
assert.equal(failure.retryable, true);
assert.equal(executionBarriers, 1, "court must first cross the FINALIZED→SETTLED barrier");
assert.equal(entitlementDebits, 1, "court must debit entitlement before forcing reservation consume loss");
assert.equal(reservationConsumes, 1, "court must reach the reservation consume CAS and lose it");
assert.equal(executionRow.phase, "finalized", "aborted transaction must restore execution to FINALIZED");
assert.equal(executionRow.settlementRealityBarrierRevision, 9, "aborted transaction must restore settlement barrier revision");
assert.equal(executionRow.settledResultReference, undefined);
assert.equal(executionRow.settledCandidateReference, undefined);
assert.equal(executionRow.settledResultDigest, undefined);
assert.equal(executionRow.settledAt, undefined);
assert.equal(entitlementRow.reservedUnits, 5, "aborted transaction must restore reserved entitlement units");
assert.equal(entitlementRow.consumedUnits, 11, "aborted transaction must remove consumed entitlement units");
assert.equal(entitlementRow.entitlementRevision, 17, "aborted transaction must restore entitlement revision");
assert.equal(reservationRow.status, "reserved", "failed consume must leave reservation reserved");
assert.equal(reservationRow.settledAt, undefined);
assert.equal(reservationRow.settlementExecutionId, undefined);
assert.equal(sessionsEnded, 1, "failed fresh settlement transaction must close its session");

console.log("✓ fresh FINALIZED→SETTLED barrier succeeds inside the transaction");
console.log("✓ entitlement debit succeeds before the forced reservation consume race");
console.log("✓ forced reservation consume loss throws MOVIE_MENTOR_INFERENCE_SETTLEMENT_RESERVATION_RACE");
console.log("✓ transaction rollback restores execution, entitlement, reservation, and settlement barrier authority");
console.log("LAW: A FRESH SETTLEMENT THAT LOSES RESERVATION CONSUMPTION AFTER ENTITLEMENT DEBIT ACQUIRES ZERO DURABLE SETTLEMENT OR DEBIT AUTHORITY.");
console.log("Movie Mentor fresh settlement reservation rollback authority: GREEN");
