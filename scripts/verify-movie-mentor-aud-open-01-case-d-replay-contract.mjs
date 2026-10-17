import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const REVERSAL_DOMAIN="iband.movie-mentor.production-commercial-reversal-authority";
const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

const principalId="creator_case_d_crash";
const commercialIntentId="intent_case_d_crash";
const paymentReference="payment_case_d_crash";
const checkoutReference="checkout_case_d_crash";
const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"});
const paidEvent=Object.freeze({provider:"provider-a",eventId:"evt_paid_reconcile_revocation",eventKind:"payment-completed",commercialIntentId,checkoutReference,providerPaymentReference:paymentReference,commerciallyFinal:true,commercialReversal:false,providerProductId:snapshot.providerProductId,amountMinor:snapshot.amountMinor,currency:snapshot.currency,environment:snapshot.environment});

let boundPayment=paymentReference,reconcileCalls=0,revokeCalls=0,settleCalls=0,settledMinor=0,crashOnce=true;
const provider=Object.freeze({
 verifyDelivery:async({delivery})=>Object.freeze({verified:true,payload:delivery}),
 normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,
 getStatus:()=>Object.freeze({domain:ADAPTER_DOMAIN,provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,providerPaymentReferenceEvidence:true,commercialReversalEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false})
});
const purchaseIntentAuthority=Object.freeze({resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,getStatus:()=>Object.freeze({domain:PURCHASE_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})});
const checkoutBindingAuthority=Object.freeze({
 resolveCheckoutBinding:async({commercialIntentId:id})=>id===commercialIntentId?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference:boundPayment}):null,
 bindProviderPaymentReference:async({providerPaymentReference})=>{boundPayment=providerPaymentReference;return Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference});},
 resolveCheckoutBindingByProviderPaymentReference:async({provider:providerName,providerPaymentReference})=>providerName==="provider-a"&&providerPaymentReference===boundPayment?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference}):null,
 revokeOpenCheckoutsForPrincipal:async({principalId:principal})=>{assert.equal(principal,principalId);revokeCalls++;return Object.freeze({revoked:true,count:1});},
 getStatus:()=>Object.freeze({domain:CHECKOUT_DOMAIN,production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})
});
const issuanceAuthority=Object.freeze({issueVerifiedEvidence:async()=>Object.freeze({authorized:true}),getStatus:()=>Object.freeze({domain:ISSUANCE_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})});
const reversalAuthority=Object.freeze({
 suspendVerifiedReversal:async({reversal})=>{assert.equal(reversal.evidenceId,"evt_case_d_chargeback");return Object.freeze({suspended:true,idempotent:revokeCalls>0,principalId});},
 preserveVerifiedReversalHistory:async()=>{throw Error("unexpected pending reversal");},
 reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0,principalId,results:[]}),
 getStatus:()=>Object.freeze({domain:REVERSAL_DOMAIN,production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false})
});
const dispositionAuthority=Object.freeze({
 preserveVerifiedPaidValue:async()=>{throw Error("unexpected preservation");},
 terminallySettlePreservedValue:async({terminalReference,chargebackAmountMinor})=>{
  settleCalls++;assert.equal(terminalReference,"evt_case_d_chargeback");assert.equal(chargebackAmountMinor,300);
  if(crashOnce){crashOnce=false;const e=new Error("CASE_D_INJECTED_CRASH_AFTER_REVOCATION");e.code="CASE_D_INJECTED_CRASH";throw e;}
  if(settledMinor===0)settledMinor=300;
  return Object.freeze({chargebackAmountMinor:settledMinor,remainingAmountMinor:900});
 },
 getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-value-disposition-authority",production:true,durablePreservedValue:true,paymentIdentityUnique:true,commercialIntentBinding:true,principalBinding:true,exactValueBinding:true,idempotentRetry:true,refundSeparate:true,processLocalFallback:false})
});

const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":provider},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority,dispositionAuthority});
const reversalEvent=Object.freeze({provider:"provider-a",eventId:"evt_case_d_chargeback",eventKind:"chargeback",providerPaymentReference:paymentReference,commercialReversal:true,reversalKind:"chargeback",reversalAmountMinor:300,currency:"GBP"});
await assert.rejects(()=>ingress.processProviderDelivery({provider:"provider-a",delivery:reversalEvent}),e=>e?.code==="CASE_D_INJECTED_CRASH");
assert.equal(revokeCalls,1);assert.equal(settleCalls,1);assert.equal(settledMinor,0);
console.log("CASE D CHECKPOINT: reversal and revocation precede injected settlement failure");
await ingress.processProviderDelivery({provider:"provider-a",delivery:reversalEvent});
assert.equal(revokeCalls,2);assert.equal(settledMinor,300);
await ingress.processProviderDelivery({provider:"provider-a",delivery:reversalEvent});
assert.equal(settledMinor,300);
assert.equal(settleCalls,3);
console.log("CASE D REPLAY GREEN: signed-event redelivery reaches settlement; duplicate mock debit fenced");
console.log("NOT PROVEN: physical MongoDB cross-ledger durability or autonomous recovery without provider redelivery");
