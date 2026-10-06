import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";

console.log("Movie Mentor preserved-credit legacy partial-refund CAS executable authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");
assert.match(source,/row\.cumulativeRefundedAmountMinor==null\?\{\$or:\[\{cumulativeRefundedAmountMinor:0\},\{cumulativeRefundedAmountMinor:\{\$exists:false\}\}\]\}:\{cumulativeRefundedAmountMinor:row\.cumulativeRefundedAmountMinor\}/,
 "production CAS must admit physical missing only when the observed legacy cumulative-refund field is absent");

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
assert.equal(logicalPrevious,0);
const repairedZeroCas={provider:"stripe",providerPaymentReference:payment,status:"preserved-credit",$or:[{cumulativeRefundedAmountMinor:0},{cumulativeRefundedAmountMinor:{$exists:false}}]};
const first=await collection.findOneAndUpdate(repairedZeroCas,{$set:{cumulativeRefundedAmountMinor:500,remainingAmountMinor:700,lastRefundReference:"evt-refund-412"}},{returnDocument:"after"});
assert.ok(first,"first partial refund must match physically missing legacy state");
assert.equal(first.cumulativeRefundedAmountMinor,500);
assert.equal(first.remainingAmountMinor,700);
const staleZero=await collection.findOneAndUpdate(repairedZeroCas,{$set:{cumulativeRefundedAmountMinor:800,remainingAmountMinor:400,lastRefundReference:"evt-stale-412"}},{returnDocument:"after"});
assert.equal(staleZero,null,"once materialized nonzero, stale logical-zero CAS must not match");
const exactNonzero=await collection.findOneAndUpdate({provider:"stripe",providerPaymentReference:payment,status:"preserved-credit",cumulativeRefundedAmountMinor:500},{$set:{cumulativeRefundedAmountMinor:800,remainingAmountMinor:400,lastRefundReference:"evt-refund-412-b"}},{returnDocument:"after"});
assert.ok(exactNonzero,"nonzero cumulative refund must advance only from exact physical prior value");
assert.equal(exactNonzero.cumulativeRefundedAmountMinor,800);
assert.equal(exactNonzero.remainingAmountMinor,400);
await collection.deleteMany({provider:"stripe",providerPaymentReference:payment});
await mongoose.disconnect();
console.log("GREEN: real Mongo admits legacy missing or explicit zero only for logical-zero first materialization; after nonzero materializes, stale zero is rejected and exact nonzero CAS advances.");
console.log("LAW: BACKWARD-COMPATIBLE NORMALIZATION MUST BE MATCHED BY BACKWARD-COMPATIBLE PHYSICAL CAS AUTHORITY; MISSING MAY REPRESENT ZERO ONLY UNTIL CURRENT PHYSICAL REFUND AUTHORITY MATERIALIZES.");
