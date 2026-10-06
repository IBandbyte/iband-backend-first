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
