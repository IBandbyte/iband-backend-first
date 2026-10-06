import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor reinstatement current-entitlement authority court");

const reversal=fs.readFileSync(new URL("../ai/MovieMentorCommercialReversalMongoStore.js",import.meta.url),"utf8");
const issuance=fs.readFileSync(new URL("../ai/MovieMentorEntitlementIssuanceMongoStore.js",import.meta.url),"utf8");
const spend=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const disposition=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");

assert.match(reversal,/status:"active",entitlementRevision:before\},\{\$set:\{status:"suspended"\},\$inc:\{entitlementRevision:1\}/,"reversal must own atomic active→suspended transition");
assert.match(issuance,/current&&text\(current\.status\)!=="active"/,"issuance must fail closed while current entitlement is suspended");
assert.match(spend,/status:"active",remainingUnits:\{\$gte:n\.units\}/,"new spend must require active current entitlement");
assert.match(disposition,/"release":"released-credit"|"released-credit"/,"preserved-value composition must expose release capability");

// Strengthen the preliminary source RED into an executable current-authority court.
// Production's owned reversal store exposes suspend but no inverse reinstatement mutation.
const {createMovieMentorCommercialReversalMongoStore}=await import("../ai/MovieMentorCommercialReversalMongoStore.js");
const entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-415",status:"suspended",remainingUnits:7,reservedUnits:0,consumedUnits:5,entitlementRevision:9};
const lean=v=>({lean:()=>({exec:async()=>v})});
const fakeModel={createIndexes:async()=>{},collection:{indexes:async()=>[{unique:true,key:{principalId:1}}]},findOne:()=>lean(entitlement),findOneAndUpdate:()=>lean(null)};
const fakeReversal={createIndexes:async()=>{},collection:{indexes:async()=>[{unique:true,key:{reversalId:1}},{unique:true,key:{evidenceSource:1,evidenceId:1}}]},findOne:()=>({session:()=>lean(null)})};
const fakePending={createIndexes:async()=>{},collection:{indexes:async()=>[{unique:true,key:{evidenceSource:1,evidenceId:1}}]}};
const store=createMovieMentorCommercialReversalMongoStore({modelSet:{entitlementModel:fakeModel,reversalModel:fakeReversal,pendingModel:fakePending}});
assert.equal(typeof store.suspend,"function","production reversal store must own suspension");
assert.equal(typeof store.reinstate,"function","RED: the durable production reversal store that owns current entitlement suspension exposes no inverse reinstatement mutation; a suspended entitlement cannot be restored by the same current-authority owner.");

const productionFiles=[
 "../ai/MovieMentorCommercialReversalMongoStore.js",
 "../ai/MovieMentorEntitlementIssuanceMongoStore.js",
 "../ai/MovieMentorInferenceSpendMongoStore.js",
 "../ai/MovieMentorProductionCommercialValueDispositionComposition.js",
 "../ai/MovieMentorProductionCommercialReversalComposition.js",
 "../ai/MovieMentorProductionCommercialProviderIngressComposition.js"
].map(p=>fs.readFileSync(new URL(p,import.meta.url),"utf8")).join("\n");
const hasReactivation=/status:"suspended"[\s\S]{0,500}\$set:\{status:"active"\}/.test(productionFiles);
assert.equal(hasReactivation,true,"RED: production can durably suspend current entitlement and all forward spend/issuance correctly fail closed, but the production authority chain exposes no owned suspended→active reinstatement transition; preserved customer value therefore cannot be safely restored to usable service without inventing fresh payment evidence.");
console.log("GREEN: production owns an authenticated current-entitlement reinstatement transition before preserved-value release.");
console.log("LAW: REINSTATEMENT MUST RESTORE CURRENT ENTITLEMENT AUTHORITY BEFORE PRESERVED CUSTOMER VALUE MAY RETURN TO USABLE SERVICE; IT MUST NOT INVENT FRESH PAYMENT EVIDENCE.");
