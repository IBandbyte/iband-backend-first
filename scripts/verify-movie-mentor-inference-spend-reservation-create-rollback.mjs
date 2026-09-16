import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

const state = {
  entitlement: {
    domain: "iband.movie-mentor.inference-spend",
    schema: 1,
    principalId: "creator-rollback",
    status: "active",
    remainingUnits: 1,
    reservedUnits: 0,
    consumedUnits: 0,
    entitlementRevision: 1,
  },
  reservations: new Map(),
};

const clone = (value) => structuredClone(value);
let activeTx = null;

function txState() {
  if (!activeTx) throw new Error("operation escaped transaction");
  return activeTx;
}

const Entitlement = {
  createIndexes: async () => {},
  collection: { indexes: async () => [{ key: { principalId: 1 }, unique: true }] },
  findOneAndUpdate(query, update) {
    return {
      lean() { return this; },
      async exec() {
        const s = txState();
        const row = s.entitlement;
        const enough = row && row.principalId === query.principalId && row.domain === query.domain && row.schema === query.schema && row.status === query.status && row.remainingUnits >= query.remainingUnits.$gte;
        if (!enough) return null;
        row.remainingUnits += update.$inc.remainingUnits;
        row.reservedUnits += update.$inc.reservedUnits;
        row.entitlementRevision += update.$inc.entitlementRevision;
        return clone(row);
      },
    };
  },
};

const Reservation = {
  createIndexes: async () => {},
  collection: { indexes: async () => [{ key: { reservationId: 1 }, unique: true }] },
  findOne() {
    return {
      session() { return this; },
      lean() { return this; },
      async exec() { return null; },
    };
  },
  async create() {
    assert.equal(txState().entitlement.remainingUnits, 0, "debit must occur before reservation create failure");
    assert.equal(txState().entitlement.reservedUnits, 1, "reserved balance must be incremented before create failure");
    throw Object.assign(new Error("simulated durable reservation create failure"), { code: 11000 });
  },
};

const startSession = async () => ({
  async withTransaction(fn) {
    const snapshot = { entitlement: clone(state.entitlement), reservations: new Map(state.reservations) };
    activeTx = snapshot;
    try {
      await fn();
      state.entitlement = snapshot.entitlement;
      state.reservations = snapshot.reservations;
    } finally {
      activeTx = null;
    }
  },
  async endSession() {},
});

const store = createMovieMentorInferenceSpendMongoStore({
  models: { entitlementModel: Entitlement, reservationModel: Reservation },
  startSession,
});

await assert.rejects(
  () => store.reserve({
    reservationId: "reservation-create-failure-1",
    principalId: "creator-rollback",
    projectId: "project-rollback",
    operation: "movie-mentor-turn",
    units: 1,
  }),
  (error) => error?.code === "MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_UNAVAILABLE",
);

assert.deepEqual(state.entitlement, {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  principalId: "creator-rollback",
  status: "active",
  remainingUnits: 1,
  reservedUnits: 0,
  consumedUnits: 0,
  entitlementRevision: 1,
}, "failed reservation creation must roll back the preceding entitlement debit");
assert.equal(state.reservations.size, 0, "failed reservation creation must leave no durable reservation row");

console.log("✓ debit followed by reservation-create failure rolls back atomically");
console.log("LAW: NO DURABLE RESERVATION ROW → NO DURABLE DEBIT.");
console.log("Movie Mentor inference spend reservation-create rollback: PASS");
