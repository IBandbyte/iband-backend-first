import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import {createMovieMentorCommercialReversalMongoStore} from "../ai/MovieMentorCommercialReversalMongoStore.js";

console.log("Movie Mentor reinstatement current-entitlement physical authority court");

const reversal=fs.readFileSync(new URL("../ai/MovieMentorCommercialReversalMongoStore.js",import.meta.url),"utf8");
const issuance=fs.readFileSync(new URL("../ai/MovieMentorEntitlementIssuanceMongoStore.js",import.meta.url),"utf8");
const spend=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const disposition=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");

assert.match(reversal,/status:"active",entitlementRevision:before\},\{\$set:\{status:"suspended"\},\$inc:\{entitlementRevision:1\}/,"reversal must own atomic active→suspended transition");
assert.match(issuance,/current&&text\(current\.status\)!=="active"/,"issuance must fail closed while current entitlement is suspended");
assert.match(spend,/status:"active",remainingUnits:\{\$gte:n\.units\}/,"new spend must require active current entitlement");
assert.match(disposition,/"release":"released-credit"|"released-credit"/,"preserved-value composition must expose release capability");

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"physical reinstatement court requires MONGO_URI");
await mongoose.connect(uri);

const entitlementCollection=mongoose.connection.db.collection("movie_mentor_inference_entitlement");
const reversalCollection=mongoose.connection.db.collection("movie_mentor_commercial_reversal");
const pendingCollection=mongoose.connection.db.collection("movie_mentor_commercial_reversal_pending");
await Promise.all([
 entitlementCollection.deleteMany({principalId:"creator-415"}),
 reversalCollection.deleteMany({principalId:"creator-415"}),
 pendingCollection.deleteMany({providerPaymentReference:"pi-reinstate-415"})
]);
await entitlementCollection.createIndex({principalId:1},{unique:true});
await reversalCollection.createIndex({reversalId:1},{unique:true});
await reversalCollection.createIndex({evidenceSource:1,evidenceId:1},{unique:true});
await pendingCollection.createIndex({evidenceSource:1,evidenceId:1},{unique:true});
await entitlementCollection.insertOne({
 domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-415",status:"suspended",
 remainingUnits:7,reservedUnits:0,consumedUnits:5,entitlementRevision:9
});

const store=createMovieMentorCommercialReversalMongoStore();
assert.equal(typeof store.suspend,"function","production reversal store must own suspension");
const before=await entitlementCollection.findOne({principalId:"creator-415"});
assert.equal(before.status,"suspended");
assert.equal(before.entitlementRevision,9);
assert.equal(before.remainingUnits,7);
assert.equal(before.reservedUnits,0);
assert.equal(before.consumedUnits,5);

assert.equal(
 typeof store.reinstate,
 "function",
 "RED: real Mongo contains a durable suspended current entitlement with conserved remaining/reserved/consumed value, but the production authority owner exposes no authenticated revision-fenced reinstatement mutation; policy-approved reinstatement therefore has no executable suspended→active path."
);

await store.reinstate({
 principalId:"creator-415",
 decisionId:"reinstatement-decision-415",
 decisionSource:"movie-mentor-enforcement",
 decisionKind:"policy-approved-reinstatement",
 decidedBy:"creator-policy-authority",
 policyVersion:"movie-mentor-enforcement-v1",
 decidedAt:"2026-10-07T09:00:00.000Z"
});
const after=await entitlementCollection.findOne({principalId:"creator-415"});
assert.equal(after.status,"active","approved reinstatement must restore current entitlement authority");
assert.equal(after.entitlementRevision,10,"reinstatement must revision-fence the current entitlement transition");
assert.equal(after.remainingUnits,7,"reinstatement must not mint or destroy remaining value");
assert.equal(after.reservedUnits,0,"reinstatement must preserve reserved value");
assert.equal(after.consumedUnits,5,"reinstatement must preserve consumed value");

await Promise.all([
 entitlementCollection.deleteMany({principalId:"creator-415"}),
 reversalCollection.deleteMany({principalId:"creator-415"}),
 pendingCollection.deleteMany({providerPaymentReference:"pi-reinstate-415"})
]);
await mongoose.disconnect();

console.log("GREEN: authenticated policy-approved reinstatement owns a durable revision-fenced suspended→active transition without minting payment evidence or changing conserved entitlement value.");
console.log("LAW: REINSTATEMENT MUST RESTORE CURRENT ENTITLEMENT AUTHORITY BEFORE PRESERVED CUSTOMER VALUE MAY RETURN TO USABLE SERVICE; IT MUST NOT INVENT FRESH PAYMENT EVIDENCE.");
