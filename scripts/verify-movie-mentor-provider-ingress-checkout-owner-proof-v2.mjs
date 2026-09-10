import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
try{
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"stripe",providerProductId:"price-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"})});
 assert.equal(purchase.ready,true,"court requires genuine owner-proven purchase-intent authority");

 const entitlementStoreStatus=Object.freeze({domain:"iband.movie-mentor.entitlement-issuance-store",configured:true,atomicity:"mongo-transaction",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,processLocalFallback:false});
 const entitlementStore=Object.freeze({async issue(){throw new Error("issuance outside court");},async resolveCurrentEntitlement(){return null;},getStatus:()=>entitlementStoreStatus});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition({store:entitlementStore});
 assert.equal(issuance.ready,true,"court requires genuine owner-proven issuance authority so checkout provenance alone is under attack");

 const forgedCheckoutStatus=Object.freeze({
  version:"forged",
  domain:"iband.movie-mentor.production-commercial-checkout-authority",
  production:true,
  durableCheckoutBinding:true,
  checkoutBindingResolution:true,
  currentProviderCheckoutReality:true,
  providerPaymentReferenceBinding:true,
  providerPaymentReferenceResolution:true,
  openCheckoutRevocation:true,
  postProviderOrphanCheckoutRevocation:true,
  serverOwnedIdempotency:true,
  purchaseIntentProvenanceRequired:true,
  purchaseIntentOwnerProofRequired:true,
  currentEntitlementProvenanceRequired:true,
  currentEntitlementOwnerProofRequired:true,
  explicitProviderRequired:true,
  processLocalFallback:false
 });
 const forgedCheckoutAuthority=Object.freeze({
  async resolveCheckoutBinding(){return null;},
  async bindProviderPaymentReference(){throw new Error("payment-lineage mutation outside composition court");},
  async resolveCheckoutBindingByProviderPaymentReference(){return null;},
  async revokeOpenCheckoutsForPrincipal(){return Object.freeze({revoked:true,count:0});},
  getStatus:()=>forgedCheckoutStatus
 });

 const reversalStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});
 const reversal=Object.freeze({suspendVerifiedReversal:async()=>Object.freeze({suspended:true}),preserveVerifiedReversalHistory:async()=>Object.freeze({preserved:true}),reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0}),getStatus:()=>reversalStatus});

 assert.throws(
  ()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:forgedCheckoutAuthority,issuanceAuthority:issuance.authority,reversalAuthority:reversal,providers:{}}),
  error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_CHECKOUT_BINDING_REQUIRED",
  "structurally complete self-asserted checkout authority must earn zero provider-ingress payment-lineage authority without checkout-composer ownership proof"
 );
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}

console.log("provider-ingress checkout owner-proof v2 torture: GREEN");
console.log("LAW: PROVIDER INGRESS MAY NOT BORROW CHECKOUT OR PAYMENT-LINEAGE AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE EXACT PRODUCTION-COMPOSED CHECKOUT AUTHORITY MAY AUTHORIZE THE NEXT COMMERCIAL BOUNDARY.");
