import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

const principalId="creator_payment_won_race",priorIntentId="intent_prior",liveIntentId="intent_live",priorPayment="pi_prior",livePayment="pi_live",liveCheckout="cs_live";
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
const snapshot={packageId:"creator-20",provider:"stripe",providerProductId:"price_20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"};
const intents={
 [priorIntentId]:Object.freeze({commercialIntentId:priorIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"}),
 [liveIntentId]:Object.freeze({commercialIntentId:liveIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"})
};
let currentEvent=null,entitlementStatus="active",boundLivePayment="",issuanceCalls=0,preservedValueCalls=0;
const preservedValues=new Map();
const stripe={checkout:{sessions:{
 create:async()=>{throw new Error("creation outside court");},
 expire:async id=>{assert.equal(id,liveCheckout);const e=new Error("checkout already has payment authority");e.raw={payment_intent:livePayment};throw e;},
 retrieve:async id=>Object.freeze({id,status:"complete",payment_status:"paid",payment_intent:livePayment,url:null})
}},webhooks:{constructEvent(){return currentEvent;}}};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_court",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});

const purchaseStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const checkoutStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const issuanceStatus=Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false});
const reversalStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});
const dispositionStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-value-disposition-authority",production:true,durablePreservedValue:true,paymentIdentityUnique:true,commercialIntentBinding:true,principalBinding:true,exactValueBinding:true,idempotentRetry:true,refundSeparate:true,partialRefundValueConservation:true,cumulativeRefundAccounting:true,processLocalFallback:false});

const purchaseIntentAuthority={resolvePurchaseIntent:async({commercialIntentId})=>intents[commercialIntentId]||null,getStatus:()=>purchaseStatus};
const checkoutBindingAuthority={
 resolveCheckoutBinding:async({commercialIntentId})=>commercialIntentId===liveIntentId?Object.freeze({commercialIntentId:liveIntentId,provider:"stripe",status:"completed",checkoutReference:liveCheckout,providerPaymentReference:boundLivePayment||null}):commercialIntentId===priorIntentId?Object.freeze({commercialIntentId:priorIntentId,provider:"stripe",status:"completed",checkoutReference:"cs_prior",providerPaymentReference:priorPayment}):null,
 bindProviderPaymentReference:async({commercialIntentId,provider,checkoutReference,providerPaymentReference})=>{assert.equal(commercialIntentId,liveIntentId);assert.equal(provider,"stripe");assert.equal(checkoutReference,liveCheckout);boundLivePayment=providerPaymentReference;return Object.freeze({commercialIntentId,provider,status:"completed",checkoutReference,providerPaymentReference});},
 resolveCheckoutBindingByProviderPaymentReference:async({provider,providerPaymentReference})=>provider!=="stripe"?null:providerPaymentReference===priorPayment?Object.freeze({commercialIntentId:priorIntentId,provider:"stripe",status:"completed",checkoutReference:"cs_prior",providerPaymentReference:priorPayment}):providerPaymentReference===boundLivePayment?Object.freeze({commercialIntentId:liveIntentId,provider:"stripe",status:"completed",checkoutReference:liveCheckout,providerPaymentReference:boundLivePayment}):null,
 revokeOpenCheckoutsForPrincipal:async({principalId:pid})=>{assert.equal(pid,principalId);await adapter.revokeCheckout({checkoutReference:liveCheckout});return Object.freeze({revoked:true,count:1});},
 getStatus:()=>checkoutStatus
};
const issuanceAuthority={issueVerifiedEvidence:async()=>{issuanceCalls++;if(entitlementStatus!=="active"){const error=new Error("Durable entitlement issuance was denied.");error.code="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_DENIED";error.reason="entitlement-suspended";throw error;}return Object.freeze({authorized:true,issued:true,principalId,units:20});},getStatus:()=>issuanceStatus};
const reversalAuthority={
 suspendVerifiedReversal:async({reversal})=>{assert.equal(reversal.principalId,principalId);entitlementStatus="suspended";return Object.freeze({suspended:true,principalId,evidenceId:reversal.evidenceId});},
 preserveVerifiedReversalHistory:async()=>Object.freeze({preserved:true}),
 reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0,principalId,results:Object.freeze([])}),
 getStatus:()=>reversalStatus
};
const dispositionAuthority={
 terminallySettlePreservedValue:async()=>{throw new Error("terminal settlement outside this court");},
 preserveVerifiedPaidValue:async({commercialIntentId,principalId:pid,provider,providerPaymentReference,amountMinor,currency,units,reason,refundAuthorized})=>{
  preservedValueCalls++;
  assert.equal(commercialIntentId,liveIntentId);
  assert.equal(pid,principalId);
  assert.equal(provider,"stripe");
  assert.equal(providerPaymentReference,livePayment);
  assert.equal(amountMinor,1200);
  assert.equal(currency,"GBP");
  assert.equal(units,20);
  assert.equal(reason,"entitlement-suspended");
  assert.equal(refundAuthorized,false);
  const key=`${provider}:${providerPaymentReference}`;
  const existing=preservedValues.get(key);
  if(existing)return existing;
  const disposition=Object.freeze({authorized:true,status:"preserved-credit",commercialIntentId,principalId:pid,provider,providerPaymentReference,amountMinor,currency,units,refundAuthorized:false});
  preservedValues.set(key,disposition);
  return disposition;
 },
 getStatus:()=>dispositionStatus
};
const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{stripe:adapter},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority,dispositionAuthority});

currentEvent=Object.freeze({id:"evt_prior_refund",type:"charge.refunded",livemode:true,data:{object:{payment_intent:priorPayment,refunded:true,amount_refunded:1200,currency:"gbp"}}});
await assert.rejects(()=>ingress.processProviderDelivery({provider:"stripe",delivery:{rawBody:Buffer.from("signed"),signature:"sig"}}),e=>e?.code==="MOVIE_MENTOR_STRIPE_CHECKOUT_REVOCATION_CONFLICT");
assert.equal(entitlementStatus,"suspended","reversal commits suspension before checkout revocation discovers provider payment won");

currentEvent=Object.freeze({id:"evt_live_paid",type:"checkout.session.completed",livemode:true,data:{object:{id:liveCheckout,client_reference_id:liveIntentId,payment_intent:livePayment,metadata:{commercialIntentId:liveIntentId,providerProductId:"price_20"},payment_status:"paid",amount_total:1200,currency:"gbp"}}});
await assert.rejects(()=>ingress.processProviderDelivery({provider:"stripe",delivery:{rawBody:Buffer.from("signed-paid"),signature:"sig"}}),error=>error?.code==="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_DENIED"&&error?.reason==="entitlement-suspended","court requires exact production issuance denial after provider-confirmed payment beats revocation");
assert.equal(boundLivePayment,livePayment,"financially-real payment must become durable exact payment lineage");
assert.equal(issuanceCalls,1,"first paid delivery reaches issuance exactly once");
assert.equal(preservedValueCalls,1,"RED: first suspended issuance denial must durably preserve the exact provider-confirmed paid value");
assert.equal(preservedValues.size,1,"one provider payment may own exactly one preserved-value disposition");

await assert.rejects(()=>ingress.processProviderDelivery({provider:"stripe",delivery:{rawBody:Buffer.from("signed-paid-retry"),signature:"sig"}}),error=>error?.code==="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_DENIED"&&error?.reason==="entitlement-suspended","provider retry remains denied by current suspension");
assert.equal(boundLivePayment,livePayment,"retry must remain bound to the same durable provider payment identity");
assert.equal(issuanceCalls,2,"provider retry may re-enter issuance but cannot create a second value universe");
assert.equal(preservedValueCalls,2,"retry must resolve the same preserved-value authority rather than bypassing disposition");
assert.equal(preservedValues.size,1,"retry must not mint a second preserved-value disposition");
const disposition=preservedValues.get(`stripe:${livePayment}`);
assert.deepEqual(disposition,Object.freeze({authorized:true,status:"preserved-credit",commercialIntentId:liveIntentId,principalId,provider:"stripe",providerPaymentReference:livePayment,amountMinor:1200,currency:"GBP",units:20,refundAuthorized:false}));
console.log("GREEN: payment-won checkout revocation conflict preserves exact paid value through one durable idempotent disposition.");
console.log("LAW: SUSPENSION MAY DENY CURRENT USE; IT MAY NOT ERASE, DUPLICATE, AUTO-REFUND OR SILENTLY STRAND PROVIDER-CONFIRMED PAID VALUE.");
