import assert from "node:assert/strict";
import { createMovieMentorCommercialReversalMongoStore } from "../ai/MovieMentorCommercialReversalMongoStore.js";

const clone = value => value == null ? value : structuredClone(value);
const q = value => ({ session(){ return this; }, lean(){ return this; }, async exec(){ return clone(value); } });

const entitlementIndexes = [{ name:"principalId_1", key:{ principalId:1 }, unique:true }];
const reversalIndexes = [
  { name:"reversalId_1", key:{ reversalId:1 }, unique:true },
  { name:"evidenceSource_1_evidenceId_1", key:{ evidenceSource:1,evidenceId:1 }, unique:true },
];
const pendingIndexes = [{ name:"evidenceSource_1_evidenceId_1", key:{ evidenceSource:1,evidenceId:1 }, unique:true }];

let entitlementRow = {
  domain:"iband.movie-mentor.inference-spend",
  schema:1,
  principalId:"creator-reversal-id-rollback",
  status:"active",
  remainingUnits:18,
  reservedUnits:3,
  consumedUnits:7,
  entitlementRevision:11,
};
const originalEntitlement = clone(entitlementRow);
let entitlementWrites = 0;
let receiptWrites = 0;
let sessionsEnded = 0;

const entitlementModel = {
  async createIndexes(){},
  collection:{ async indexes(){ return entitlementIndexes; } },
  findOne(){ return q(entitlementRow); },
  findOneAndUpdate(filter, update){
    return {
      lean(){ return this; },
      async exec(){
        assert.equal(filter.principalId, entitlementRow.principalId);
        assert.equal(filter.status, "active");
        assert.equal(filter.entitlementRevision, 11);
        entitlementWrites += 1;
        entitlementRow = {
          ...entitlementRow,
          status:update.$set.status,
          entitlementRevision:entitlementRow.entitlementRevision + update.$inc.entitlementRevision,
        };
        return clone(entitlementRow);
      },
    };
  },
};

const reversalModel = {
  async createIndexes(){},
  collection:{ async indexes(){ return reversalIndexes; } },
  findOne(){ return q(null); },
  async create(){ receiptWrites += 1; throw new Error("receipt write must not be reached when reversal identity is invalid"); },
};

const pendingModel = {
  async createIndexes(){},
  collection:{ async indexes(){ return pendingIndexes; } },
};

const session = {
  async withTransaction(fn){
    const snapshot = clone(entitlementRow);
    try { return await fn(); }
    catch (error) { entitlementRow = snapshot; throw error; }
  },
  async endSession(){ sessionsEnded += 1; },
};

const store = createMovieMentorCommercialReversalMongoStore({
  modelSet:{ entitlementModel, reversalModel, pendingModel },
  startSession:async()=>session,
  createReversalId:()=>"   ",
  now:()=>new Date("2036-01-02T00:00:00.000Z"),
});

await assert.rejects(
  ()=>store.suspend({
    evidenceId:"evt-reversal-id-rollback",
    evidenceSource:"provider-a",
    evidenceKind:"refund",
    providerPaymentReference:"payment-reversal-id-rollback",
    commercialReference:"intent-reversal-id-rollback",
    principalId:"creator-reversal-id-rollback",
    reversalAmountMinor:1200,
    currency:"GBP",
  }),
  error=>error?.code === "MOVIE_MENTOR_COMMERCIAL_REVERSAL_RECEIPT_INVALID" && error.message.includes("Reversal identity could not be created"),
);

assert.equal(entitlementWrites, 1, "entitlement suspension must occur before identity validation fails");
assert.equal(receiptWrites, 0, "receipt write must not occur after invalid identity");
assert.deepEqual(entitlementRow, originalEntitlement, "transaction abort must restore the entitlement exactly");
assert.equal(entitlementRow.status, "active");
assert.equal(entitlementRow.entitlementRevision, 11);
assert.equal(sessionsEnded, 1, "session must end exactly once");

console.log("GREEN: entitlement suspension is restored when reversal identity creation fails.");
