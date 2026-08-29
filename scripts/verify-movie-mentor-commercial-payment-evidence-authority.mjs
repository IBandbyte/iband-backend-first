import assert from "node:assert/strict";
import { createMovieMentorCommercialPaymentEvidenceAuthority } from "../ai/MovieMentorCommercialPaymentEvidenceAuthority.js";
import { createMovieMentorCommercialPaymentEvidenceBridge } from "../ai/MovieMentorCommercialPaymentEvidenceBridge.js";

const baseEvent = Object.freeze({ eventId:"evt_1", provider:"test-provider", eventKind:"payment-completed", commercialIntentId:"intent_1", commerciallyFinal:true, providerProductId:"prod_creator20", amountMinor:1200, currency:"GBP", environment:"live" });
const intent = Object.freeze({ commercialIntentId:"intent_1", principalId:"principal_A", packageId:"creator-20" });
const policy = Object.freeze({ packageId:"creator-20", provider:"test-provider", providerProductId:"prod_creator20", amountMinor:1200, currency:"GBP", environment:"live", units:20 });

function authority(overrides={}) {
  return createMovieMentorCommercialPaymentEvidenceAuthority({
    verifyDelivery: overrides.verifyDelivery || (async ({delivery}) => delivery?.signature === "valid" ? {verified:true,payload:delivery.payload} : {verified:false}),
    normalizeEvent: overrides.normalizeEvent || (async ({verifiedDelivery}) => verifiedDelivery.payload),
    resolvePurchaseIntent: overrides.resolvePurchaseIntent || (async ({commercialIntentId}) => commercialIntentId === intent.commercialIntentId ? intent : null),
    resolveCommercialPolicy: overrides.resolveCommercialPolicy || (async ({packageId,provider}) => packageId === policy.packageId && provider === policy.provider ? policy : null),
  });
}
async function rejects(code, fn){ await assert.rejects(fn, e => e?.code === code); }

await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_DELIVERY_UNVERIFIED",()=>authority().verifyCommercialDelivery({delivery:{signature:"forged",payload:baseEvent}}));
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_NOT_FINAL",()=>authority().verifyCommercialDelivery({delivery:{signature:"valid",payload:{...baseEvent,commerciallyFinal:false}}}));
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_INTENT_NOT_FOUND",()=>authority().verifyCommercialDelivery({delivery:{signature:"valid",payload:{...baseEvent,commercialIntentId:"invented"}}}));
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_PRODUCT_MISMATCH",()=>authority().verifyCommercialDelivery({delivery:{signature:"valid",payload:{...baseEvent,providerProductId:"prod_fake"}}}));
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_AMOUNT_MISMATCH",()=>authority().verifyCommercialDelivery({delivery:{signature:"valid",payload:{...baseEvent,amountMinor:1}}}));
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_CURRENCY_MISMATCH",()=>authority().verifyCommercialDelivery({delivery:{signature:"valid",payload:{...baseEvent,currency:"USD"}}}));
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_ENVIRONMENT_MISMATCH",()=>authority().verifyCommercialDelivery({delivery:{signature:"valid",payload:{...baseEvent,environment:"test"}}}));

const a=authority();
const e1=await a.verifyCommercialDelivery({delivery:{signature:"valid",payload:baseEvent}});
const e2=await a.verifyCommercialDelivery({delivery:{signature:"valid",payload:baseEvent}});
assert.equal(e1.verified,true); assert.equal(e1.principalId,"principal_A"); assert.equal(e1.units,20); assert.equal(e1.evidenceId,"evt_1"); assert.equal(e1.evidenceDigest,e2.evidenceDigest,"provider retries must normalize to identical durable evidence binding");

let issued=0;
const bridge=createMovieMentorCommercialPaymentEvidenceBridge({evidenceAuthority:a,issuanceAuthority:{async issueVerifiedEvidence({evidence}){assert.equal(evidence.verified,true);issued++;return {authorized:true,evidenceId:evidence.evidenceId};}}});
await bridge.processProviderDelivery({delivery:{signature:"valid",payload:baseEvent}}); assert.equal(issued,1);

let unitsSeen=null;
const malicious={...baseEvent,units:999999,principalId:"victim"};
const safe=await a.verifyCommercialDelivery({delivery:{signature:"valid",payload:malicious}}); unitsSeen=safe.units; assert.equal(unitsSeen,20); assert.equal(safe.principalId,"principal_A");

const legacy=authority({verifyDelivery:async()=>({verified:false})});
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_DELIVERY_UNVERIFIED",()=>legacy.verifyCommercialDelivery({delivery:{type:"legacy-purchases-json",paid:true}}));

console.log("PASS Door 5A.7 — forged/unfinalized/mismatched commerce cannot manufacture verified evidence; server policy owns units; durable intent owns principal; retries preserve evidence identity; only verified evidence reaches sealed 5A.6.");
