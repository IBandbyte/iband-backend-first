import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor unclaimed release reservation rollback authority court");

const clone = value => value == null ? value : structuredClone(value);

const executionId = "execution-release-rollback";
const principalId = "creator-release-rollback";
const projectId = "project-release-rollback";
const reservationId = "reservation-release-rollback";

let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store",
  schema: 6,
  phase: "active",
  executionId,
  principalId,
  projectId,
  reservationId,
  providerCallsClaimed: 0,
  providerCalls: [],
  settlementRealityBarrierRevision: 12,
};
let reservationRow = {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  reservationId,
  principalId,
  projectId,
  operation: "movie-mentor-turn",
  units: 3,
  status: "reserved",
};
let entitlementRow = {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  principalId,
  reservedUnits: 7,
  remainingUnits: 19,
  consumedUnits: 5,
  entitlementRevision: 31,
};

let executionBarriers = 0;
let entitlementRefunds = 0;
let reservationReleases = 0;
let sessionsEnded = 0;

const collections = {
  movie_mentor_inference_execution: {
    async findOne() { return clone(executionRow); },
    async updateOne(filter, update) {
      executionBarriers += 1;
      assert.equal(filter.executionId, executionId);
      assert.equal(filter.phase, "active");
      assert.equal(filter.reservationId, reservationId);
      assert.equal(filter.providerCallsClaimed, 0);
      assert.deepEqual(filter["providerCalls.0"], { $exists: false });
      Object.assign(executionRow, clone(update.$set));
      executionRow.settlementRealityBarrierRevision += update.$inc.settlementRealityBarrierRevision;
      return { matchedCount: 1, modifiedCount: 1 };
    },
  },
  movie_mentor_inference_spend_reservation: {
    async findOne() { return clone(reservationRow); },
    async findOneAndUpdate(filter) {
      reservationReleases += 1;
      assert.equal(filter.reservationId, reservationId);
      assert.equal(filter.status, "reserved");
      return null;
    },
  },
  movie_mentor_inference_entitlement: {
    async findOneAndUpdate(filter, update) {
      entitlementRefunds += 1;
      assert.equal(filter.principalId, principalId);
      assert.equal(filter.domain, "iband.movie-mentor.inference-spend");
      assert.equal(filter.schema, 1);
      assert.equal(filter.reservedUnits.$gte, 3);
      entitlementRow.reservedUnits += update.$inc.reservedUnits;
      entitlementRow.remainingUnits += update.$inc.remainingUnits;
      entitlementRow.entitlementRevision += update.$inc.entitlementRevision;
      return clone(entitlementRow);
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
    const beforeExecution = clone(executionRow);
    const beforeReservation = clone(reservationRow);
    const beforeEntitlement = clone(entitlementRow);
    try {
      return await fn();
    } catch (error) {
      executionRow = beforeExecution;
      reservationRow = beforeReservation;
      entitlementRow = beforeEntitlement;
      throw error;
    }
  },
  async endSession() { sessionsEnded += 1; },
});

const store = createMovieMentorInferenceSettlementMongoStore({
  connect: async () => {},
  startSession,
  db: () => database,
  now: () => new Date("2036-02-01T00:00:00.000Z"),
});

let failure = null;
try {
  await store.releaseUnclaimedReservation({ executionId });
} catch (error) {
  failure = error;
}

assert.ok(failure, "lost reservation release must fail closed");
assert.equal(failure.code, "MOVIE_MENTOR_INFERENCE_RELEASE_RESERVATION_RACE");
assert.equal(failure.retryable, true);
assert.equal(executionBarriers, 1, "court must first cross ACTIVE→ABORTED barrier");
assert.equal(entitlementRefunds, 1, "court must refund entitlement before forcing reservation release loss");
assert.equal(reservationReleases, 1, "court must reach reservation release CAS and lose it");

assert.equal(executionRow.phase, "active", "aborted transaction must restore execution to ACTIVE");
assert.equal(executionRow.settlementRealityBarrierRevision, 12, "aborted transaction must restore settlement barrier revision");
assert.equal(executionRow.abortedAt, undefined);
assert.equal(executionRow.abortReason, undefined);

assert.equal(entitlementRow.reservedUnits, 7, "aborted transaction must restore reserved entitlement units");
assert.equal(entitlementRow.remainingUnits, 19, "aborted transaction must remove refunded entitlement units");
assert.equal(entitlementRow.consumedUnits, 5, "release rollback must not alter consumed entitlement units");
assert.equal(entitlementRow.entitlementRevision, 31, "aborted transaction must restore entitlement revision");

assert.equal(reservationRow.status, "reserved", "failed release must leave reservation reserved");
assert.equal(reservationRow.settledAt, undefined);
assert.equal(reservationRow.settlementReason, undefined);
assert.equal(sessionsEnded, 1, "failed unclaimed release transaction must close its session");

console.log("✓ ACTIVE→ABORTED barrier succeeds inside the transaction");
console.log("✓ entitlement refund succeeds before the forced reservation release race");
console.log("✓ forced reservation release loss throws MOVIE_MENTOR_INFERENCE_RELEASE_RESERVATION_RACE");
console.log("✓ transaction rollback restores execution, entitlement, reservation, and barrier authority");
console.log("LAW: AN UNCLAIMED RELEASE THAT LOSES RESERVATION RELEASE AFTER ENTITLEMENT REFUND ACQUIRES ZERO DURABLE ABORT OR REFUND AUTHORITY.");
console.log("Movie Mentor unclaimed release reservation rollback authority: GREEN");
