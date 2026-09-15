import assert from "node:assert/strict";
import { createMovieMentorEntitlementIssuanceMongoStore } from "../ai/MovieMentorEntitlementIssuanceMongoStore.js";

console.log("Movie Mentor new entitlement receipt rollback verifier");

const clone = value => value == null ? value : structuredClone(value);
const entitlementIndexes = [{ name: "principalId_1", key: { principalId: 1 }, unique: true }];
const issuanceIndexes = [
  { name: "issuanceId_1", key: { issuanceId: 1 }, unique: true },
  { name: "evidenceSource_1_evidenceId_1", key: { evidenceSource: 1, evidenceId: 1 }, unique: true },
];

let entitlementRow = null;
let entitlementCreates = 0;
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
  findOne() { return query(entitlementRow); },
  async create(rows) {
    entitlementCreates += 1;
    assert.equal(entitlementRow, null, "new-entitlement path must begin without an entitlement");
    entitlementRow = clone(rows[0]);
    return [clone(entitlementRow)];
  },
};

const forcedReceiptFailure = new Error("forced issuance receipt write failure after new entitlement creation");
forcedReceiptFailure.code = "TEST_NEW_ENTITLEMENT_RECEIPT_WRITE_FAILURE";

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
  createIssuanceId: () => "issuance-new-entitlement-rollback",
  now: () => new Date("2035-01-01T00:00:00.000Z"),
});

await assert.rejects(
  () => store.issue({
    evidenceId: "payment-new-entitlement-rollback",
    evidenceSource: "test-payment-provider",
    evidenceKind: "payment-confirmed",
    evidenceDigest: "digest-new-entitlement-rollback",
    principalId: "creator-new-entitlement-rollback",
    units: 5,
    commercialReference: "commercial-new-entitlement-rollback",
  }),
  error => error?.code === "MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_AUTHORITY_UNAVAILABLE" &&
    error.message.includes("forced issuance receipt write failure after new entitlement creation"),
  "receipt write failure must abort the new-entitlement issuance transaction",
);

assert.equal(entitlementCreates, 1, "new entitlement must genuinely be created before the forced receipt failure");
assert.equal(receiptWrites, 1, "issuance receipt write must be attempted once after new entitlement creation");
assert.equal(entitlementRow, null, "transaction rollback must remove the newly created entitlement completely");
assert.equal(sessionsEnded, 1, "transaction session must be ended exactly once");

console.log("GREEN: newly created entitlement disappears when the later issuance receipt write fails.");
