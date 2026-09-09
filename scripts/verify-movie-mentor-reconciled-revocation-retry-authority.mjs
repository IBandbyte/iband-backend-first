import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const REVERSAL_DOMAIN="iband.movie-mentor.production-commercial-reversal-authority";
const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

const principalId="creator_reconcile_retry";
const commercialIntentId="intent_reconcile_retry";
const checkoutReference="checkout_reconcile_retry";
const paymentReference="payment_reconcile_retry";
const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"});
const paidEvent=Object.freeze({provider:"provider-a",eventId:"evt_paid_reconcile_retry",eventKind:"payment-completed",commercialIntentId,checkoutReference,providerPaymentReference:paymentReference,commerciallyFinal:true,commercialReversal:false,providerProductId:snapshot.providerProductId,amountMinor:snapshot.amountMinor,currency:snapshot.currency,environment:snapshot.environment});

let boundPayment=null;
let issuanceCalls=0;
let reconciled=false;
let revocationCalls=0;
const provider=Object.freeze({
 verifyDelivery:async({delivery})=>Object.freeze({verified:true,payload:delivery}),
 normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,
 getStatus:()=>Object.freeze({domain:ADAPTER_DOMAIN,provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,providerPaymentReferenceEvidence:true,commercialReversalEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false})
});
const purchaseIntentAuthority=Object.freeze({
 resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,
 getStatus:()=>Object.freeze({domain:PURCHASE_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})
});
const checkoutBindingAuthority=Object.freeze({
 resolveCheckoutBinding:async({commercialIntentId:id})=>id===commercialIntentId?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference:boundPayment}):null,
 bindProviderPaymentReference:async({providerPaymentReference})=>{boundPayment=providerPaymentReference;return Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference});},
 resolveCheckoutBindingByProviderPaymentReference:async({provider:providerName,providerPaymentReference})=>providerName==="provider-a"&&providerPaymentReference===boundPayment?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference}):null,
 revokeOpenCheckoutsForPrincipal:async({principalId:principal})=>{assert.equal(principal,principalId);revocationCalls++;if(revocationCalls===1){const error=new Error("transient provider checkout revocation failure after durable reconciliation");error.code="MOVIE_MENTOR_CHECKOUT_REVOCATION_TRANSIENT";throw error;}return Object.freeze({revoked:true,count:1});},
 getStatus:()=>Object.freeze({domain:CHECKOUT_DOMAIN,production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})
});
const issuanceAuthority=Object.freeze({
 issueVerifiedEvidence:async()=>{issuanceCalls++;if(issuanceCalls===1)return Object.freeze({authorized:true,principalId,units:snapshot.units,idempotent:false});const error=new Error("Historical issuance receipt cannot borrow current entitlement authority after entitlement suspension or loss.");error.code="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_IDEMPOTENT_STATUS_FENCED";error.issuanceId="issuance_reconcile_retry";error.retryable=false;throw error;},
 getStatus:()=>Object.freeze({domain:ISSUANCE_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})
});
const reversalAuthority=Object.freeze({
 suspendVerifiedReversal:async()=>{throw new Error("direct reversal is outside this retry court");},
 preserveVerifiedReversalHistory:async()=>{throw new Error("pending history is already durable before this retry court begins");},
 reconcilePendingReversals:async({evidenceSource,providerPaymentReference,commercialReference,principalId:principal})=>{assert.equal(evidenceSource,"provider-a");assert.equal(providerPaymentReference,paymentReference);assert.equal(commercialReference,commercialIntentId);assert.equal(principal,principalId);if(reconciled)return Object.freeze({reconciled:true,count:0,principalId,results:Object.freeze([])});reconciled=true;return Object.freeze({reconciled:true,count:1,principalId,results:Object.freeze([Object.freeze({suspended:true,principalId,commercialReference:commercialIntentId,providerPaymentReference:paymentReference})])});},
 getStatus:()=>Object.freeze({domain:REVERSAL_DOMAIN,production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false})
});

const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":provider},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority});
await assert.rejects(()=>ingress.processProviderDelivery({provider:"provider-a",delivery:paidEvent}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_REVOCATION_TRANSIENT","court requires durable reconciliation to succeed before the first checkout revocation attempt fails");
assert.equal(reconciled,true,"pending reversal must already be durably reconciled before revocation failure");
assert.equal(revocationCalls,1,"first attempt must cross checkout revocation exactly once");

const recovered=await ingress.processProviderDelivery({provider:"provider-a",delivery:paidEvent});
assert.equal(revocationCalls,2,"exact paid-event retry must re-enter checkout revocation even after pending history has already been consumed");
assert.equal(recovered?.status,"historical-issuance-current-authority-fenced");
assert.equal(recovered?.checkoutRevocationRecovered,true);
assert.equal(recovered?.principalId,principalId);
assert.equal(recovered?.idempotent,true);
console.log("✓ durable pending-reversal reconciliation cannot lose checkout revocation authority across a post-reconciliation failure");
console.log("✓ exact commercially-final payment retry recovers checkout revocation even when historical issuance is now fenced by current suspension");
console.log("LAW: RECONCILIATION MAY CONSUME PENDING HISTORY; IT MAY NOT CONSUME THE DUTY TO REVOKE OUTSTANDING CHARGE-CAPABLE CHECKOUT AUTHORITY.");
console.log("reconciled-revocation retry authority torture: GREEN");
