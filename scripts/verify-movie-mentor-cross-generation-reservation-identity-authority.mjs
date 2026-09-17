import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

const historical = Object.freeze({
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  reservationId: "reservation-cross-generation-1",
  principalId: "creator-cross-generation",
  projectId: "project-historical-generation",
  operation: "movie-mentor-turn",
  units: 1,
  entitlementRevision: 7,
  status: "reserved",
  reservedAt: new Date("2036-01-01T00:00:00.000Z"),
  settledAt: null,
  settlementReason: null,
  settlementExecutionId: null,
  settlementResultReference: null,
  settlementCandidateReference: null,
  settlementResultDigest: null,
});

const entitlement = {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  principalId: "creator-cross-generation",
  status: "active",
  remainingUnits: 4,
  reservedUnits: 1,
  consumedUnits: 0,
  entitlementRevision: 7,
};

let debitWrites = 0;
let reservationCreates = 0;
let sessionEnded = false;

const query = (value) => ({
  session() { return this; },
  lean() { return this; },
  async exec() { return value; },
});

const Reservation = {
  async create() {
    reservationCreates += 1;
    throw new Error("conflicting historical reservation must prevent reservation creation");
  },
  findOne(filter) {
    assert.equal(filter?.reservationId, historical.reservationId);
    return query({ ...historical });
  },
  collection: {
    async indexes() { return [{ key: { reservationId: 1 }, unique: true }]; },
  },
  async createIndexes() {},
};

const Entitlement = {
  findOneAndUpdate() {
    debitWrites += 1;
    throw new Error("conflicting historical reservation must fail before entitlement mutation");
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
    reservationId: historical.reservationId,
    principalId: historical.principalId,
    projectId: "project-new-generation",
    operation: historical.operation,
    units: historical.units,
  }),
  (error) => error?.code === "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_CONFLICT" && error?.retryable !== true,
  "a distinct creator-turn generation must not adopt a historical reservation identity bound to different spend authority",
);

assert.equal(debitWrites, 0, "reservation identity conflict must occur before any new entitlement debit");
assert.equal(reservationCreates, 0, "reservation identity conflict must not create a second reservation row");
assert.equal(entitlement.remainingUnits, 4, "historical collision must leave durable remaining units unchanged");
assert.equal(entitlement.reservedUnits, 1, "historical collision must leave historical reserved units unchanged");
assert.equal(entitlement.entitlementRevision, 7, "historical collision must not advance entitlement revision");
assert.equal(sessionEnded, true, "conflict path must always end its Mongo session");

console.log("GREEN: cross-generation reservation identity collision fails closed before debit or reservation creation.");
console.log("LAW: A NEW CREATOR-TURN GENERATION MAY NOT ADOPT A HISTORICAL RESERVATION IDENTITY BOUND TO DIFFERENT SPEND AUTHORITY.");
