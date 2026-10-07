import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import {createMovieMentorCommercialReversalMongoStore} from "../ai/MovieMentorCommercialReversalMongoStore.js";
import {createMovieMentorReinstatementDecisionMongoStore} from "../ai/MovieMentorReinstatementDecisionMongoStore.js";

console.log("Movie Mentor reinstatement durable-decision + current-entitlement physical authority court");

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

const principalId="creator-415";
const decisionId="reinstatement-decision-415";
const entitlementCollection=mongoose.connection.db.collection("movie_mentor_inference_entitlement");
const reversalCollection=mongoose.connection.db.collection("movie_mentor_commercial_reversal");
const pendingCollection=mongoose.connection.db.collection("movie_mentor_commercial_reversal_pending");
const decisionCollection=mongoose.connection.db.collection("movie_mentor_reinstatement_decision");
await Promise.all([
 entitlementCollection.deleteMany({principalId}),
 reversalCollection.deleteMany({principalId}),
 pendingCollection.deleteMany({providerPaymentReference:"pi-reinstate-415"}),
 decisionCollection.deleteMany({$or:[{principalId},{decisionId}]})
]);
await entitlementCollection.createIndex({principalId:1},{unique:true});
await reversalCollection.createIndex({reversalId:1},{unique:true});
await reversalCollection.createIndex({evidenceSource:1,evidenceId:1},{unique:true});
await pendingCollection.createIndex({evidenceSource:1,evidenceId:1},{unique:true});
await entitlementCollection.insertOne({
 domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"suspended",
 remainingUnits:7,reservedUnits:0,consumedUnits:5,entitlementRevision:9
});
await reversalCollection.insertOne({
 reversalId:"reversal-history-415",evidenceSource:"stripe",evidenceId:"evt-reversal-415",
 evidenceKind:"charge-refunded",principalId,providerPaymentReference:"pi-reinstate-415",
 commercialReference:"intent-415",evidenceDigest:"sha256:reversal-415",
 entitlementRevisionBefore:8,entitlementRevisionAfter:9,status:"suspended",
 suspendedAt:"2026-10-06T09:00:00.000Z"
});

const decisionStore=createMovieMentorReinstatementDecisionMongoStore();
assert.equal(typeof decisionStore.recordAuthorizedDecision,"function","reinstatement policy authority must own durable decision creation");
assert.equal(typeof decisionStore.resolveAuthorizedDecision,"function","entitlement mutation must consume durable authority by stable decision identity");

const authorizedDecision=Object.freeze({
 decisionId,principalId,
 decisionSource:"movie-mentor-enforcement",
 decisionKind:"policy-approved-reinstatement",
 decidedBy:"creator-policy-authority",
 policyVersion:"movie-mentor-enforcement-v1",
 appealReference:"appeal-415",
 decidedAt:"2026-10-07T09:00:00.000Z"
});
const recorded=await decisionStore.recordAuthorizedDecision({decision:authorizedDecision});
assert.equal(recorded.authorized,true);
assert.equal(recorded.idempotent,false);

const replay=await decisionStore.recordAuthorizedDecision({decision:authorizedDecision});
assert.equal(replay.authorized,true);
assert.equal(replay.idempotent,true,"same durable decision replay must be idempotent");

await assert.rejects(
 ()=>decisionStore.recordAuthorizedDecision({decision:{...authorizedDecision,principalId:"creator-other"}}),
 error=>error?.code==="MOVIE_MENTOR_REINSTATEMENT_DECISION_CONFLICT",
 "same decision identity with contradictory authority evidence must fail closed"
);

const durableDecision=await decisionStore.resolveAuthorizedDecision({decisionId,principalId});
assert.equal(durableDecision?.decisionId,decisionId);
assert.equal(durableDecision?.principalId,principalId);
assert.equal(durableDecision?.decisionKind,"policy-approved-reinstatement");

const store=createMovieMentorCommercialReversalMongoStore();
assert.equal(typeof store.suspend,"function","production reversal store must own suspension");
assert.equal(typeof store.reinstateAuthorizedDecision,"function","RED: durable policy-approved reinstatement evidence exists, but the physical entitlement owner exposes no authority-consuming revision-fenced suspended→active mutation.");

const before=await entitlementCollection.findOne({principalId});
const reversalBefore=await reversalCollection.findOne({reversalId:"reversal-history-415"});
assert.equal(before.status,"suspended");
assert.equal(before.entitlementRevision,9);

await assert.rejects(
 ()=>store.reinstateAuthorizedDecision({
   principalId,
   decision:{...authorizedDecision,decisionId:"fabricated-caller-decision"},
   expectedEntitlementRevision:9
 }),
 error=>error?.code==="MOVIE_MENTOR_REINSTATEMENT_DECISION_NOT_DURABLE",
 "caller-supplied decision fields must never self-authorize reinstatement"
);

const first=await store.reinstateAuthorizedDecision({
 principalId,
 decision:durableDecision,
 expectedEntitlementRevision:9
});
assert.equal(first.reinstated,true);
assert.equal(first.idempotent,false);

const after=await entitlementCollection.findOne({principalId});
assert.equal(after.status,"active","approved reinstatement must restore current entitlement authority");
assert.equal(after.entitlementRevision,10,"reinstatement must revision-fence the current entitlement transition");
assert.equal(after.remainingUnits,7,"reinstatement must not mint or destroy remaining value");
assert.equal(after.reservedUnits,0,"reinstatement must preserve reserved value");
assert.equal(after.consumedUnits,5,"reinstatement must preserve consumed value");

const reversalAfter=await reversalCollection.findOne({reversalId:"reversal-history-415"});
assert.deepEqual(reversalAfter,reversalBefore,"reinstatement must retain immutable historical reversal evidence");

const second=await store.reinstateAuthorizedDecision({
 principalId,
 decision:durableDecision,
 expectedEntitlementRevision:9
});
assert.equal(second.reinstated,true);
assert.equal(second.idempotent,true,"same authorized decision replay must not create a second entitlement transition");
const afterReplay=await entitlementCollection.findOne({principalId});
assert.equal(afterReplay.entitlementRevision,10,"idempotent replay must not increment entitlement revision again");
assert.equal(afterReplay.remainingUnits,7);
assert.equal(afterReplay.reservedUnits,0);
assert.equal(afterReplay.consumedUnits,5);

await Promise.all([
 entitlementCollection.deleteMany({principalId}),
 reversalCollection.deleteMany({principalId}),
 pendingCollection.deleteMany({providerPaymentReference:"pi-reinstate-415"}),
 decisionCollection.deleteMany({$or:[{principalId},{decisionId}]})
]);
await mongoose.disconnect();

console.log("GREEN: durable authenticated reinstatement decision authority is distinct from entitlement mutation authority; exact decision replay is idempotent; conflict fails closed; suspended→active is revision-fenced; conserved value and reversal history are unchanged.");
console.log("LAW: REINSTATEMENT DECISION AUTHORITY MAY AUTHORIZE THE TRANSITION, BUT IT MAY NOT DIRECTLY MUTATE CUSTOMER VALUE; ENTITLEMENT AUTHORITY MAY EXECUTE A DURABLE AUTHORIZED DECISION, BUT IT MAY NOT INVENT ONE.");
