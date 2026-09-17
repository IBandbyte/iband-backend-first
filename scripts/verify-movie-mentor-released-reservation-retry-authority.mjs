import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

const reservation = Object.freeze({
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  reservationId: "turn-deterministic-released-reservation",
  principalId: "creator-released-retry",
  projectId: "project-released-retry",
  operation: "movie-mentor-turn",
  units: 1,
  entitlementRevision: 8,
  status: "released",
  reservedAt: new Date("2037-01-01T00:00:00.000Z"),
  settledAt: new Date("2037-01-01T00:00:05.000Z"),
  settlementReason: "unclaimed-reservation-released",
  settlementExecutionId: null,
  settlementResultReference: null,
  settlementCandidateReference: null,
  settlementResultDigest: null,
});

const entitlement = {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  principalId: reservation.principalId,
  status: "active",
  remainingUnits: 5,
  reservedUnits: 0,
  consumedUnits: 0,
  entitlementRevision: 9,
};

let entitlementMutations = 0;
let reservationCreates = 0;
let sessionEnded = false;

const query = (value) => ({
  session() { return this; },
  lean() { return this; },
  async exec() { return value; },
});

const Reservation = {
  findOne(filter) {
    assert.equal(filter?.reservationId, reservation.reservationId);
    return query({ ...reservation });
  },
  async create() {
    reservationCreates += 1;
    throw new Error("released reservation retry must never create a replacement reservation");
  },
  collection: {
    async indexes() { return [{ key: { reservationId: 1 }, unique: true }]; },
  },
  async createIndexes() {},
};

const Entitlement = {
  findOneAndUpdate() {
    entitlementMutations += 1;
    throw new Error("released reservation retry must fail before entitlement mutation");
  },
  collection: {
    async indexes() { return [{ key: { principalId: 1 }, unique: true }]; },
  },
  async createIndexes() {},
};

const session = {
  async withTransaction(fn) { return fn(); },
  async endSession() { sessionEnded = true; },
};

const store = createMovieMentorInferenceSpendMongoStore({
  models: { entitlementModel: Entitlement, reservationModel: Reservation },
  startSession: async () => session,
});

await assert.rejects(
  () => store.reserve({
    reservationId: reservation.reservationId,
    principalId: reservation.principalId,
    projectId: reservation.projectId,
    operation: reservation.operation,
    units: reservation.units,
  }),
  (error) => error?.code === "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_SETTLED" && error?.retryable !== true,
  "same-turn retry must not resurrect a durably released deterministic reservation identity",
);

assert.equal(entitlementMutations, 0, "released reservation retry must not mutate entitlement authority");
assert.equal(reservationCreates, 0, "released reservation retry must not create a new reservation row");
assert.deepEqual(entitlement, {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  principalId: reservation.principalId,
  status: "active",
  remainingUnits: 5,
  reservedUnits: 0,
  consumedUnits: 0,
  entitlementRevision: 9,
}, "released reservation retry must leave durable economics unchanged");
assert.equal(sessionEnded, true, "released reservation retry must always end its Mongo session");

console.log("GREEN: released deterministic reservation history cannot be reserved again by the same creator-turn retry.");
console.log("LAW: RELEASED ECONOMIC HISTORY MAY SURVIVE; IT MAY NOT BECOME FRESH SPEND AUTHORITY AGAIN.");
