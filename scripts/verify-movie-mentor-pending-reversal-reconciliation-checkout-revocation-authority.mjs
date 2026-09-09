import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const REVERSAL_DOMAIN="iband.movie-mentor.production-commercial-reversal-authority";
const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

const principalId="creator_pending_reconcile_revocation";
const commercialIntentId="intent_pending_reconcile_revocation";
const paymentReference="payment_pending_reconcile_revocation";
const checkoutReference="checkout_pending_reconcile_revocation";
const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"});
const paidEvent=Object.freeze({provider:"provider-a",eventId:"evt_paid_reconcile_revocation",eventKind:"payment-completed",commercialIntentId,checkoutReference,providerPaymentReference:paymentReference,commerciallyFinal:true,commercialReversal:false,providerProductId:snapshot.providerProductId,amountMinor:snapshot.amountMinor,currency:snapshot.currency,environment:snapshot.environment});

let boundPayment=null,reconcileCalls=0,revokeCalls=0;
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
 suspendVerifiedReversal:async()=>{throw new Error("direct reversal suspension is outside this reconciliation court");},
 preserveVerifiedReversalHistory:async()=>{throw new Error("pending history was already durable before this court begins");},
 reconcilePendingReversals:async({evidenceSource,providerPaymentReference,commercialReference,principalId:principal})=>{reconcileCalls++;assert.equal(evidenceSource,"provider-a");assert.equal(providerPaymentReference,paymentReference);assert.equal(commercialReference,commercialIntentId);assert.equal(principal,principalId);return Object.freeze({reconciled:true,count:1,principalId,results:Object.freeze([Object.freeze({suspended:true,principalId,commercialReference:commercialIntentId,providerPaymentReference:paymentReference})])});},
 getStatus:()=>Object.freeze({domain:REVERSAL_DOMAIN,production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false})
});

const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":provider},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority});
const result=await ingress.processProviderDelivery({provider:"provider-a",delivery:paidEvent});
assert.equal(result.authorized,true);
assert.equal(boundPayment,paymentReference);
assert.equal(reconcileCalls,1,"commercially-final payment must reconcile pending verified reversal history");
assert.equal(revokeCalls,1,"when pending reversal reconciliation suspends current entitlement, open charge-capable checkout authority must be revoked for that principal");
console.log("✓ pending reversal reconciliation cannot suspend current entitlement without revoking outstanding checkout authority");
console.log("LAW: PENDING REVERSAL HISTORY MAY WAIT FOR LINEAGE; ONCE RECONCILIATION SUSPENDS CURRENT AUTHORITY, OPEN CHARGE-CAPABLE CHECKOUT AUTHORITY MUST DIE TOO.");
console.log("pending-reversal reconciliation checkout-revocation torture: GREEN");
