import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorCommercialReversalAuthority} from "../ai/MovieMentorCommercialReversalAuthority.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

const STORE_DOMAIN="iband.movie-mentor.commercial-reversal-store";
const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const REVERSAL_DOMAIN="iband.movie-mentor.production-commercial-reversal-authority";
const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const principalId="creator_pending_crash";
const commercialIntentId="intent_pending_crash";
const checkoutReference="checkout_pending_crash";
const paymentReference="payment_pending_crash";
const evidenceId="evt_refund_pending_crash";
const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"});
const paidEvent=Object.freeze({provider:"provider-a",eventId:"evt_paid_pending_crash",eventKind:"payment-completed",commercialIntentId,checkoutReference,providerPaymentReference:paymentReference,commerciallyFinal:true,commercialReversal:false,providerProductId:snapshot.providerProductId,amountMinor:snapshot.amountMinor,currency:snapshot.currency,environment:snapshot.environment});

let pending=[Object.freeze({evidenceId,evidenceSource:"provider-a",evidenceKind:"refund",providerPaymentReference:paymentReference,reversalAmountMinor:1200,currency:"GBP",verifiedAt:"2036-01-01T00:00:00.000Z",status:"pending-lineage"})];
let suspended=false;
let removeCalls=0;
let revokeCalls=0;
const reversalStore=Object.freeze({
  async suspend(input){
    suspended=true;
    return Object.freeze({suspended:true,idempotent:false,receipt:Object.freeze({reversalId:"reversal_pending_crash",evidenceId:input.evidenceId,evidenceSource:input.evidenceSource,evidenceKind:input.evidenceKind,providerPaymentReference:input.providerPaymentReference,commercialReference:input.commercialReference,principalId:input.principalId,reversalAmountMinor:input.reversalAmountMinor,currency:input.currency,entitlementRevisionBefore:1,entitlementRevisionAfter:2,status:"suspended",reversedAt:"2036-01-01T00:00:01.000Z"})});
  },
  async preservePending(){throw new Error("pending history already exists before crash court");},
  async listPending({evidenceSource,providerPaymentReference}){return pending.filter(row=>row.evidenceSource===evidenceSource&&row.providerPaymentReference===providerPaymentReference);},
  async removePending({evidenceSource,evidenceId:id}){removeCalls+=1;pending=pending.filter(row=>!(row.evidenceSource===evidenceSource&&row.evidenceId===id));return Object.freeze({removed:true});},
  getStatus(){return Object.freeze({domain:STORE_DOMAIN,configured:true,atomicity:"mongo-transaction",reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});}
});
const rawReversal=createMovieMentorCommercialReversalAuthority({store:reversalStore});
const reversalAuthority=Object.freeze({
  suspendVerifiedReversal:rawReversal.suspendVerifiedReversal,
  preserveVerifiedReversalHistory:rawReversal.preserveVerifiedReversalHistory,
  reconcilePendingReversals:rawReversal.reconcilePendingReversals,
  getStatus:()=>Object.freeze({domain:REVERSAL_DOMAIN,production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false})
});
let boundPayment=null;
const provider=Object.freeze({verifyDelivery:async({delivery})=>Object.freeze({verified:true,payload:delivery}),normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,getStatus:()=>Object.freeze({domain:ADAPTER_DOMAIN,provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,providerPaymentReferenceEvidence:true,commercialReversalEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false})});
const purchaseIntentAuthority=Object.freeze({resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,getStatus:()=>Object.freeze({domain:PURCHASE_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})});
const checkoutBindingAuthority=Object.freeze({
  resolveCheckoutBinding:async({commercialIntentId:id})=>id===commercialIntentId?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference:boundPayment}):null,
  bindProviderPaymentReference:async({providerPaymentReference})=>{boundPayment=providerPaymentReference;return Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference});},
  resolveCheckoutBindingByProviderPaymentReference:async({provider:providerName,providerPaymentReference})=>providerName==="provider-a"&&providerPaymentReference===boundPayment?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference}):null,
  revokeOpenCheckoutsForPrincipal:async()=>{revokeCalls+=1;const error=new Error("simulated process loss at checkout revocation boundary");error.code="MOVIE_MENTOR_CHECKOUT_REVOCATION_CRASH";throw error;},
  getStatus:()=>Object.freeze({domain:CHECKOUT_DOMAIN,production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})
});
const issuanceAuthority=Object.freeze({issueVerifiedEvidence:async()=>Object.freeze({authorized:true,principalId,units:snapshot.units}),getStatus:()=>Object.freeze({domain:ISSUANCE_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})});

const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":provider},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority});
await assert.rejects(()=>ingress.processProviderDelivery({provider:"provider-a",delivery:paidEvent}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_REVOCATION_CRASH");
assert.equal(suspended,true,"court requires current entitlement suspension to become durable before checkout revocation crashes");
assert.equal(removeCalls,0,"pending reversal history must not be consumed before checkout revocation authority has succeeded or an equivalent durable revocation obligation exists");
assert.equal(pending.length,1,"a crash after suspension but before checkout revocation must leave a durable retry trigger without requiring provider redelivery");
assert.equal(revokeCalls,1,"court must reach the checkout-revocation crash boundary exactly once");
console.log("PASS pending reversal history survives until checkout revocation duty is durably discharged");
console.log("LAW: RECONCILIATION MAY SUSPEND CURRENT AUTHORITY, BUT IT MAY NOT ERASE ITS LAST DURABLE RETRY TRIGGER BEFORE CHECKOUT REVOCATION IS DURABLY SATISFIED.");
