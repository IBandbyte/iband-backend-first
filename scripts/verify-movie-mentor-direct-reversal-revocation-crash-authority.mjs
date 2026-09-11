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

const principalId="creator_direct_reversal_crash";
const commercialIntentId="intent_direct_reversal_crash";
const checkoutReference="checkout_direct_reversal_crash";
const paymentReference="payment_direct_reversal_crash";
const evidenceId="evt_direct_reversal_crash";
const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId,principalId,...snapshot,policyDigest:digest(snapshot),status:"created"});
const reversalEvent=Object.freeze({provider:"provider-a",eventId:evidenceId,eventKind:"refund",providerPaymentReference:paymentReference,commerciallyFinal:false,commercialReversal:true,reversalAmountMinor:1200,currency:"GBP"});

let pending=[];
let suspended=false;
let preserveCalls=0;
let removeCalls=0;
let revokeCalls=0;
const reversalStore=Object.freeze({
  async suspend(input){
    suspended=true;
    return Object.freeze({suspended:true,idempotent:false,receipt:Object.freeze({reversalId:"reversal_direct_crash",evidenceId:input.evidenceId,evidenceSource:input.evidenceSource,evidenceKind:input.evidenceKind,providerPaymentReference:input.providerPaymentReference,commercialReference:input.commercialReference,principalId:input.principalId,reversalAmountMinor:input.reversalAmountMinor,currency:input.currency,entitlementRevisionBefore:1,entitlementRevisionAfter:2,status:"suspended",reversedAt:"2036-01-02T00:00:01.000Z"})});
  },
  async preservePending(input){
    preserveCalls+=1;
    const history=Object.freeze({...input,status:"pending-lineage"});
    pending.push(history);
    return Object.freeze({preserved:true,idempotent:false,alreadyReconciled:false,history});
  },
  async listPending({evidenceSource,providerPaymentReference}){return pending.filter(row=>row.evidenceSource===evidenceSource&&row.providerPaymentReference===providerPaymentReference);},
  async removePending({evidenceSource,evidenceId:id}){removeCalls+=1;pending=pending.filter(row=>!(row.evidenceSource===evidenceSource&&row.evidenceId===id));return Object.freeze({removed:true});},
  getStatus(){return Object.freeze({domain:STORE_DOMAIN,configured:true,atomicity:"mongo-transaction",reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});}
});
const rawReversal=createMovieMentorCommercialReversalAuthority({store:reversalStore});
const reversalAuthority=Object.freeze({
  suspendVerifiedReversal:rawReversal.suspendVerifiedReversal,
  preserveVerifiedReversalHistory:rawReversal.preserveVerifiedReversalHistory,
  reconcilePendingReversals:rawReversal.reconcilePendingReversals,
  acknowledgePendingReversals:rawReversal.acknowledgePendingReversals,
  getStatus:()=>Object.freeze({domain:REVERSAL_DOMAIN,production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,pendingReversalAcknowledgement:true,pendingHistorySurvivesUntilRevocationAcknowledgement:true,processLocalFallback:false})
});
const provider=Object.freeze({verifyDelivery:async({delivery})=>Object.freeze({verified:true,payload:delivery}),normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,getStatus:()=>Object.freeze({domain:ADAPTER_DOMAIN,provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,providerPaymentReferenceEvidence:true,commercialReversalEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false})});
const purchaseIntentAuthority=Object.freeze({resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,getStatus:()=>Object.freeze({domain:PURCHASE_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})});
const checkoutBindingAuthority=Object.freeze({
  resolveCheckoutBinding:async()=>null,
  bindProviderPaymentReference:async()=>{throw new Error("payment binding outside direct reversal crash court");},
  resolveCheckoutBindingByProviderPaymentReference:async({provider:providerName,providerPaymentReference})=>providerName==="provider-a"&&providerPaymentReference===paymentReference?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference,providerPaymentReference}):null,
  revokeOpenCheckoutsForPrincipal:async({principalId:id})=>{assert.equal(id,principalId);revokeCalls+=1;const error=new Error("simulated process loss after durable suspension");error.code="MOVIE_MENTOR_CHECKOUT_REVOCATION_CRASH";throw error;},
  getStatus:()=>Object.freeze({domain:CHECKOUT_DOMAIN,production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})
});
const issuanceAuthority=Object.freeze({issueVerifiedEvidence:async()=>{throw new Error("issuance outside direct reversal crash court");},getStatus:()=>Object.freeze({domain:ISSUANCE_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})});

const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":provider},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority});
await assert.rejects(()=>ingress.processProviderDelivery({provider:"provider-a",delivery:reversalEvent}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_REVOCATION_CRASH");
assert.equal(suspended,true,"court requires direct verified reversal suspension to become durable before checkout revocation crashes");
assert.equal(revokeCalls,1,"court must reach direct checkout-revocation boundary exactly once");
assert.equal(preserveCalls,1,"direct reversal must establish a durable retry trigger before durable suspension can outrun checkout revocation");
assert.equal(removeCalls,0,"direct reversal retry trigger must not be consumed before checkout revocation succeeds");
assert.equal(pending.length,1,"process loss after direct suspension must leave durable revocation retry authority without depending on provider redelivery");
console.log("PASS direct reversal preserves durable revocation retry authority across suspension/revocation process loss");
console.log("LAW: DIRECT REVERSAL SUSPENSION MAY NOT OUTRUN THE LAST DURABLE RETRY TRIGGER FOR OUTSTANDING CHARGE-CAPABLE CHECKOUT REVOCATION.");
