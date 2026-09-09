import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const principalId="creator_revocation_race";
const priorIntentId="intent_prior_paid_1";
const openIntentId="intent_open_checkout_after_reversal";
const openCheckoutReference="cs_open_after_reversal";
const priorPaymentReference="pi_prior_paid_1";
let entitlement=Object.freeze({principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:70});
let providerSessionStatus="open",expireCalls=0,revokeCalls=0;
const priorIntent=Object.freeze({commercialIntentId:priorIntentId,principalId,packageId:"creator-20",provider:"stripe",providerProductId:"price_20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"prior-digest",status:"created"});
const openIntent=Object.freeze({...priorIntent,commercialIntentId:openIntentId,policyDigest:"open-digest"});
let currentWebhookEvent=null;
const stripe={
 checkout:{sessions:{
  create:async()=>Object.freeze({id:openCheckoutReference,url:`https://checkout.stripe.test/${openCheckoutReference}`,expires_at:2208988800}),
  expire:async id=>{assert.equal(id,openCheckoutReference);expireCalls++;providerSessionStatus="expired";return Object.freeze({id,status:"expired",url:null});}
 }},
 webhooks:{constructEvent(){return currentWebhookEvent;}}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_revocation",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
let openBinding=Object.freeze({commercialIntentId:openIntentId,provider:"stripe",idempotencyKey:`movie-mentor:${openIntentId}`,status:"pending"});
const checkoutInitiation=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async({commercialIntentId})=>commercialIntentId===openIntentId?openIntent:null,
 resolveCurrentEntitlement:async()=>entitlement,
 createProviderCheckout:({intent,idempotencyKey})=>adapter.createCheckout({intent,idempotencyKey}),
 checkoutBindingStore:{
  async begin(){return openBinding;},
  async complete({checkoutReference,checkoutUrl,expiresAt}){openBinding=Object.freeze({...openBinding,status:"completed",checkoutReference,checkoutUrl,expiresAt,providerPaymentReference:null});return openBinding;},
  async resolve(){return openBinding;}
 },
 now:()=>new Date("2030-01-01T00:00:00.000Z")
});
const issued=await checkoutInitiation.initiateCheckout({principalId,commercialIntentId:openIntentId});
assert.equal(issued.authorized,true);assert.equal(issued.checkoutReference,openCheckoutReference);assert.equal(providerSessionStatus,"open");

const purchaseStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const checkoutStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const issuanceStatus=Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false});
const reversalStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});
const purchaseIntentAuthority={resolvePurchaseIntent:async({commercialIntentId})=>commercialIntentId===priorIntentId?priorIntent:commercialIntentId===openIntentId?openIntent:null,getStatus:()=>purchaseStatus};
const checkoutBindingAuthority={
 resolveCheckoutBinding:async()=>null,
 bindProviderPaymentReference:async()=>{throw new Error("payment binding is outside reversal court");},
 resolveCheckoutBindingByProviderPaymentReference:async({provider,providerPaymentReference})=>provider==="stripe"&&providerPaymentReference===priorPaymentReference?Object.freeze({commercialIntentId:priorIntentId,provider:"stripe",status:"completed",checkoutReference:"cs_prior_paid_1",providerPaymentReference:priorPaymentReference}):null,
 revokeOpenCheckoutsForPrincipal:async({principalId:principal})=>{assert.equal(principal,principalId);revokeCalls++;if(providerSessionStatus==="open"){await stripe.checkout.sessions.expire(openCheckoutReference);}return Object.freeze({revoked:true,count:1});},
 getStatus:()=>checkoutStatus
};
const issuanceAuthority={issueVerifiedEvidence:async()=>{throw new Error("issuance is outside reversal court");},getStatus:()=>issuanceStatus};
const reversalAuthority={
 suspendVerifiedReversal:async({reversal})=>{assert.equal(reversal.principalId,principalId);entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:71});return Object.freeze({suspended:true,reversalId:"rev_prior_1",evidenceId:reversal.evidenceId,evidenceSource:reversal.evidenceSource,principalId,commercialReference:priorIntentId,providerPaymentReference:priorPaymentReference,entitlementRevision:71});},
 preserveVerifiedReversalHistory:async()=>{throw new Error("lineage exists; pending history is outside this court");},
 reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0}),
 getStatus:()=>reversalStatus
};
currentWebhookEvent=Object.freeze({id:"evt_refund_prior_1",type:"charge.refunded",livemode:true,data:{object:{payment_intent:priorPaymentReference,amount_refunded:1200,currency:"gbp",refunded:true}}});
const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{stripe:adapter},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority});
const reversalResult=await ingress.processProviderDelivery({provider:"stripe",delivery:{rawBody:Buffer.from("signed-refund"),signature:"sig"}});
assert.equal(reversalResult.suspended,true);assert.equal(entitlement.status,"suspended");
assert.equal(revokeCalls,1,"the reversal orchestration owner must revoke outstanding charge-capable checkout authority for the newly suspended principal");
assert.equal(expireCalls,1,"the provider checkout revocation boundary must be crossed exactly once");
assert.equal(providerSessionStatus,"expired","an already-issued hosted checkout may survive as history, but must not remain charge-capable after current entitlement suspension");
console.log("✓ verified reversal suspension revokes already-issued open provider checkout authority for the same principal");
console.log("LAW: CHECKOUT HISTORY MAY SURVIVE SUSPENSION; AN OPEN CHARGE-CAPABLE PROVIDER SESSION MAY NOT.");
console.log("suspension-revokes-open-checkout authority torture: GREEN");