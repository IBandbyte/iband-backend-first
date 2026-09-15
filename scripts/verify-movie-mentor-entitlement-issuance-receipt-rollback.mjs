import assert from "node:assert/strict";
import { createMovieMentorEntitlementIssuanceMongoStore } from "../ai/MovieMentorEntitlementIssuanceMongoStore.js";

console.log("Movie Mentor entitlement issuance receipt rollback verifier");

const clone = value => value == null ? value : structuredClone(value);
const entitlementIndexes = [{ name: "principalId_1", key: { principalId: 1 }, unique: true }];
const issuanceIndexes = [
  { name: "issuanceId_1", key: { issuanceId: 1 }, unique: true },
  { name: "evidenceSource_1_evidenceId_1", key: { evidenceSource: 1, evidenceId: 1 }, unique: true },
];

let entitlementRow = {
  domain: "iband.movie-mentor.inference-spend",
  schema: 1,
  principalId: "creator-receipt-rollback",
  status: "active",
  remainingUnits: 20,
  reservedUnits: 4,
  consumedUnits: 6,
  entitlementRevision: 9,
};
const before = clone(entitlementRow);
let entitlementWrites = 0;
let receiptWrites = 0;
let sessionsEnded = 0;

function query(value) {
  return {
    session() { return this; },
    lean() { return this; },
    async exec() { return clone(value); },
  };
}

const entitlementModel = {
  collection: { async indexes() { return entitlementIndexes; } },
  async createIndexes() {},
  findOne(filter) {
    if (filter?.principalId !== entitlementRow?.principalId) return query(null);
    return query(entitlementRow);
  },
  findOneAndUpdate(filter, update) {
    const matches = entitlementRow &&
      filter?.principalId === entitlementRow.principalId &&
      filter?.status === entitlementRow.status &&
      filter?.entitlementRevision === entitlementRow.entitlementRevision;
    if (!matches) return query(null);
    entitlementWrites += 1;
    entitlementRow = {
      ...entitlementRow,
      remainingUnits: entitlementRow.remainingUnits + update.$inc.remainingUnits,
      entitlementRevision: entitlementRow.entitlementRevision + update.$inc.entitlementRevision,
    };
    return query(entitlementRow);
  },
};

const forcedReceiptFailure = new Error("forced issuance receipt write failure");
forcedReceiptFailure.code = "TEST_ISSUANCE_RECEIPT_WRITE_FAILURE";

const issuanceModel = {
  collection: { async indexes() { return issuanceIndexes; } },
  async createIndexes() {},
  findOne() { return query(null); },
  async create() {
    receiptWrites += 1;
    throw forcedReceiptFailure;
  },
};

const session = {
  async withTransaction(fn) {
    const snapshot = clone(entitlementRow);
    try {
      return await fn();
    } catch (error) {
      entitlementRow = snapshot;
      throw error;
    }
  },
  async endSession() { sessionsEnded += 1; },
};

const store = createMovieMentorEntitlementIssuanceMongoStore({
  modelSet: { entitlementModel, issuanceModel },
  startSession: async () => session,
  createIssuanceId: () => "issuance-receipt-rollback",
  now: () => new Date("2035-01-01T00:00:00.000Z"),
});

await assert.rejects(
  () => store.issue({
    evidenceId: "payment-receipt-rollback",
    evidenceSource: "test-payment-provider",
    evidenceKind: "payment-confirmed",
    evidenceDigest: "digest-receipt-rollback",
    principalId: "creator-receipt-rollback",
    units: 5,
    commercialReference: "commercial-receipt-rollback",
  }),
  error => error?.code === "MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_AUTHORITY_UNAVAILABLE" &&
    error.message.includes("forced issuance receipt write failure"),
  "receipt write failure must abort the issuance transaction",
);

assert.equal(entitlementWrites, 1, "entitlement update must genuinely succeed before the forced receipt failure");
assert.equal(receiptWrites, 1, "issuance receipt write must be attempted once after entitlement mutation");
assert.deepEqual(entitlementRow, before, "transaction rollback must restore the complete pre-issuance entitlement record");
assert.equal(entitlementRow.remainingUnits, 20, "rolled-back entitlement must not retain issued units");
assert.equal(entitlementRow.entitlementRevision, 9, "rolled-back entitlement must restore its previous revision");
assert.equal(sessionsEnded, 1, "transaction session must be ended exactly once");

console.log("GREEN: entitlement mutation rolls back when the later issuance receipt write fails.");
