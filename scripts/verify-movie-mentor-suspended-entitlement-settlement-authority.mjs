import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor suspended entitlement settlement authority court");

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

const executionId = "execution-suspended-settlement";
const creatorTurnId = "turn-suspended-settlement";
const principalId = "creator-suspended-settlement";
const projectId = "project-suspended-settlement";
const reservationId = "reservation-suspended-settlement";
const requestDigest = "request-suspended-settlement";
const closureReference = "closure-suspended-settlement";
const resultReference = "result-suspended-settlement";
const candidateReference = "candidate-suspended-settlement";
const resultPayload = { response: { message: "historical reserved work" }, metadata: { agent: "mentor" } };
const resultDigest = stableDigest(resultPayload);
const frozenProviderCallSetDigest = digest([]);
const closurePolicyVersion = "policy-suspended-settlement";
const closureCertificateDigest = digest({
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest,
  closureReference, frozenProviderCallSetDigest, closurePolicyVersion, realities: [],
});

let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store", schema: 6, phase: "finalized",
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest,
  leaseGeneration: 4, leaseReference: "lease-suspended-settlement", fencingToken: "fence-suspended-settlement",
  providerCallsClaimed: 0, providerCalls: [], frozenProviderCallCount: 0, frozenProviderCallSetDigest,
  closurePolicyVersion, closureReference, closureCertificateDigest, providerEffectRealityRevision: 12,
  settlementRealityBarrierRevision: 3, finalizedResultReference: resultReference,
  finalizedCandidateReference: candidateReference, finalizedResultDigest: resultDigest,
  resultFinalizedAt: "2036-02-01T00:00:00.000Z",
};
const resultRow = {
  domain: "iband.movie-mentor.canonical-result-store", schema: 2, resultReference, candidateReference,
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest,
  closureReference, closureCertificateDigest, resultDigest, resultPayload: stable(resultPayload),
};
const candidateRow = {
  domain: "iband.movie-mentor.result-candidate-store", schema: 2, candidateReference,
  executionId, creatorTurnId, principalId, projectId, reservationId, requestDigest,
  resultDigest, resultPayload: stable(resultPayload), stagedFromLeaseGeneration: 4,
  stagedFromLeaseReference: "lease-suspended-settlement", stagedFromFencingToken: "fence-suspended-settlement",
  creatorStateRevision: 5, creatorStateGeneration: 2, creatorStateFingerprint: "state-suspended-settlement",
  creatorStateOwnershipRef: "ownership-suspended-settlement", creatorStateOwnershipRevision: 3,
  stagedAt: "2036-01-31T23:59:59.000Z",
};
let reservationRow = {
  domain: "iband.movie-mentor.inference-spend", schema: 1, reservationId, principalId, projectId,
  operation: "movie-mentor-turn", units: 1, entitlementRevision: 7, status: "reserved",
  reservedAt: "2036-01-31T23:59:50.000Z", settledAt: null, settlementReason: null,
};
let entitlementRow = {
  domain: "iband.movie-mentor.inference-spend", schema: 1, principalId,
  status: "suspended", remainingUnits: 19, reservedUnits: 1, consumedUnits: 0, entitlementRevision: 8,
};

let executionBarriers = 0, entitlementMutations = 0, reservationMutations = 0, sessionsEnded = 0;
const matches = (row, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === "reservedUnits" && expected?.$gte !== undefined) return row.reservedUnits >= expected.$gte;
  if (key === "$or") return true;
  return row[key] === expected;
});
const apply = (row, update) => {
  if (update.$set) Object.assign(row, clone(update.$set));
  if (update.$inc) for (const [key, amount] of Object.entries(update.$inc)) row[key] = (row[key] || 0) + amount;
};

const collections = {
  movie_mentor_inference_execution: {
    async findOne() { return clone(executionRow); },
    async updateOne(filter, update) {
      executionBarriers += 1;
      if (!matches(executionRow, filter)) return { matchedCount: 0, modifiedCount: 0 };
      apply(executionRow, update);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  },
  movie_mentor_canonical_result: { async findOne() { return clone(resultRow); } },
  movie_mentor_result_candidate: { async findOne() { return clone(candidateRow); } },
  movie_mentor_provider_effect_reality: { find() { return { async toArray() { return []; } }; } },
  movie_mentor_inference_spend_reservation: {
    async findOne() { return clone(reservationRow); },
    async findOneAndUpdate(filter, update) {
      reservationMutations += 1;
      if (!matches(reservationRow, filter)) return null;
      apply(reservationRow, update);
      return clone(reservationRow);
    },
  },
  movie_mentor_inference_entitlement: {
    async findOneAndUpdate(filter, update) {
      entitlementMutations += 1;
      assert.equal(filter.principalId, principalId);
      assert.equal(filter.domain, "iband.movie-mentor.inference-spend");
      assert.equal(filter.schema, 1);
      assert.equal(filter.status, undefined, "settlement must consume historical reserved balance without restoring active status");
      if (!matches(entitlementRow, filter)) return null;
      apply(entitlementRow, update);
      return clone(entitlementRow);
    },
  },
};
const database = { collection(name) { const collection = collections[name]; assert.ok(collection, `unexpected collection: ${name}`); return collection; } };
const startSession = async () => ({
  async withTransaction(fn) {
    const before = { execution: clone(executionRow), reservation: clone(reservationRow), entitlement: clone(entitlementRow) };
    try { return await fn(); }
    catch (error) { executionRow = before.execution; reservationRow = before.reservation; entitlementRow = before.entitlement; throw error; }
  },
  async endSession() { sessionsEnded += 1; },
});

const store = createMovieMentorInferenceSettlementMongoStore({
  connect: async () => {}, startSession, db: () => database, now: () => new Date("2036-02-01T00:00:01.000Z"),
});
const outcome = await store.settleCanonicalResult({ executionId });

assert.equal(outcome.settled, true);
assert.equal(outcome.authorized, true);
assert.equal(outcome.outcome, "consumed");
assert.equal(outcome.idempotent, false);
assert.equal(outcome.executionPhase, "settled");
assert.equal(executionBarriers, 1);
assert.equal(entitlementMutations, 1);
assert.equal(reservationMutations, 1);
assert.equal(executionRow.phase, "settled");
assert.equal(executionRow.settlementRealityBarrierRevision, 4);
assert.equal(entitlementRow.status, "suspended", "historical settlement must not recreate current entitlement authority");
assert.equal(entitlementRow.remainingUnits, 19, "settlement must not mint or refund spendable units");
assert.equal(entitlementRow.reservedUnits, 0, "the pre-existing reservation must be consumed");
assert.equal(entitlementRow.consumedUnits, 1, "the historical reserved unit must become consumed economic history");
assert.equal(entitlementRow.entitlementRevision, 9);
assert.equal(reservationRow.status, "consumed");
assert.equal(reservationRow.settlementExecutionId, executionId);
assert.equal(reservationRow.settlementResultReference, resultReference);
assert.equal(reservationRow.settlementCandidateReference, candidateReference);
assert.equal(reservationRow.settlementResultDigest, resultDigest);
assert.equal(sessionsEnded, 1);

console.log("✓ real settlement store reaches canonical settlement after entitlement suspension");
console.log("✓ only the already-reserved unit is consumed; no spendable units are minted or restored");
console.log("✓ entitlement remains suspended while durable reservation and execution become settled history");
console.log("LAW: REVOCATION BLOCKS NEW SPEND AUTHORITY; IT DOES NOT ERASE OR RE-AUTHORIZE ALREADY-RESERVED ECONOMIC HISTORY.");
console.log("Movie Mentor suspended entitlement settlement authority: GREEN");
