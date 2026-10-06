import assert from "node:assert/strict";
import mongoose from "mongoose";

console.log("Movie Mentor preserved-credit legacy partial-refund CAS executable authority court");

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"physical court requires MONGO_URI");
await mongoose.connect(uri);
const collection=mongoose.connection.db.collection("movie_mentor_commercial_value_disposition");
const payment="pi-legacy-partial-refund-cas-412";
await collection.deleteMany({provider:"stripe",providerPaymentReference:payment});
await collection.insertOne({
 provider:"stripe",providerPaymentReference:payment,commercialIntentId:"intent-412",principalId:"creator-412",
 amountMinor:1200,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false,
 status:"preserved-credit",terminalDisposition:null,terminalReference:null,preservedAt:new Date("2026-01-01T00:00:00.000Z")
});
let row=await collection.findOne({provider:"stripe",providerPaymentReference:payment});
assert.equal(Object.hasOwn(row,"cumulativeRefundedAmountMinor"),false,"fixture must be physically pre-partial-refund schema");
const logicalPrevious=Number.isSafeInteger(row.cumulativeRefundedAmountMinor)?row.cumulativeRefundedAmountMinor:0;
assert.equal(logicalPrevious,0,"legacy normalization must interpret missing cumulative refund as logical zero");
const legacyCas={provider:"stripe",providerPaymentReference:payment,status:"preserved-credit",cumulativeRefundedAmountMinor:row.cumulativeRefundedAmountMinor??0};
const first=await collection.findOneAndUpdate(legacyCas,{$set:{cumulativeRefundedAmountMinor:500,remainingAmountMinor:700,lastRefundReference:"evt-refund-412"}},{returnDocument:"after"});
assert.equal(first,null,"RED: production-shaped numeric-zero CAS unexpectedly matched a physically missing legacy cumulative-refund field");
row=await collection.findOne({provider:"stripe",providerPaymentReference:payment});
assert.equal(Object.hasOwn(row,"cumulativeRefundedAmountMinor"),false,"RED: failed first CAS leaves legacy row physically missing");
const second=await collection.findOneAndUpdate(legacyCas,{$set:{cumulativeRefundedAmountMinor:500,remainingAmountMinor:700,lastRefundReference:"evt-refund-412"}},{returnDocument:"after"});
assert.equal(second,null,"RED: unchanged recursive retry predicate unexpectedly made progress");
await collection.deleteMany({provider:"stripe",providerPaymentReference:payment});
await mongoose.disconnect();
assert.fail("RED: real Mongo proves legacy missing cumulative-refund state cannot satisfy production numeric-zero CAS; unchanged recursive retry cannot make progress.");
