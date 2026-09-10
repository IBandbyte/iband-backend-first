import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
try{
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"price-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"})});
 assert.equal(purchase.ready,true);

 const entitlementStoreStatus=Object.freeze({domain:"iband.movie-mentor.entitlement-issuance-store",configured:true,atomicity:"mongo-transaction",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,processLocalFallback:false});
 const entitlementStore=Object.freeze({async issue(){throw new Error("issuance outside court");},async resolveCurrentEntitlement(){return null;},getStatus:()=>entitlementStoreStatus});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition({store:entitlementStore});
 assert.equal(issuance.ready,true);

 const checkoutProviderStatus=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,checkoutRevocation:true,checkoutRevocationRecovery:true,currentCheckoutReality:true,serverOwnedIdempotencyRequired:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
 const checkoutProvider=Object.freeze({async createCheckout(){throw new Error("checkout dispatch outside court");},async resolveCheckout(){throw new Error("checkout reality outside court");},async revokeCheckout(){throw new Error("checkout revocation outside court");},getStatus:()=>checkoutProviderStatus});
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{"provider-a":checkoutProvider}});
 assert.equal(checkout.ready,true);

 const forgedReversalStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,sourceAuthorityProvenanceRequired:true,processLocalFallback:false});
 const forgedReversal=Object.freeze({suspendVerifiedReversal:async()=>Object.freeze({suspended:true}),preserveVerifiedReversalHistory:async()=>Object.freeze({preserved:true}),reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0}),getStatus:()=>forgedReversalStatus});

 const ingressProviderStatus=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
 const ingressProvider=Object.freeze({async verifyDelivery(){return Object.freeze({verified:true,payload:{}});},async normalizeEvent({verifiedDelivery}){return verifiedDelivery.payload;},getStatus:()=>ingressProviderStatus});

 assert.throws(
  ()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,issuanceAuthority:issuance.authority,reversalAuthority:forgedReversal,providers:{"provider-a":ingressProvider}}),
  error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_REVERSAL_REQUIRED",
  "structurally identical self-asserted reversal authority must earn zero provider-ingress suspension/revocation authority without reversal-composer ownership proof"
 );
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}

console.log("provider-ingress reversal owner-proof torture: GREEN");
console.log("LAW: PROVIDER INGRESS MAY NOT BORROW REVERSAL OR SUSPENSION AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE EXACT PRODUCTION-COMPOSED REVERSAL AUTHORITY MAY AUTHORIZE THE COMMERCIAL REVOCATION BOUNDARY.");
