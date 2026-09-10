import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";

const purchaseSnapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
try{
 const ownedPurchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>purchaseSnapshot});
 const entitlementStoreStatus=Object.freeze({domain:"iband.movie-mentor.entitlement-issuance-store",configured:true,atomicity:"mongo-transaction",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,processLocalFallback:false});
 const entitlementStore=Object.freeze({async issue(){throw new Error("issuance outside checkout fixture");},async resolveCurrentEntitlement(){return null;},getStatus:()=>entitlementStoreStatus});
 const ownedEntitlement=createMovieMentorProductionEntitlementIssuanceComposition({store:entitlementStore});
 assert.equal(ownedEntitlement.ready,true);
 const checkoutProviderStatus=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,checkoutRevocation:true,checkoutRevocationRecovery:true,currentCheckoutReality:true,serverOwnedIdempotencyRequired:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
 const checkoutProvider=Object.freeze({async createCheckout(){throw new Error("checkout dispatch outside composition fixture");},async resolveCheckout(){throw new Error("checkout reality outside composition fixture");},async revokeCheckout(){throw new Error("checkout revocation outside composition fixture");},getStatus:()=>checkoutProviderStatus});
 const ownedCheckout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:ownedPurchase.authority,entitlementAuthority:ownedEntitlement.authority,providers:{"provider-a":checkoutProvider}});
 assert.equal(ownedCheckout.ready,true,"issuance owner-proof court requires genuine owner-proven checkout neighbour");

 const forgedIssuanceStatus=Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,ownerBoundProof:true,processLocalFallback:false});
 const forgedIssuance=Object.freeze({issueVerifiedEvidence:async()=>Object.freeze({authorized:true}),getStatus:()=>forgedIssuanceStatus});
 const reversalStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});
 const reversal=Object.freeze({suspendVerifiedReversal:async()=>Object.freeze({suspended:true}),preserveVerifiedReversalHistory:async()=>Object.freeze({preserved:true}),reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0}),getStatus:()=>reversalStatus});

 assert.throws(
  ()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:ownedPurchase.authority,checkoutBindingAuthority:ownedCheckout.authority,issuanceAuthority:forgedIssuance,reversalAuthority:reversal,providers:{}}),
  error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED",
  "self-asserted issuance status must earn zero provider-ingress authority without entitlement composer's exact owner proof"
 );
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}

console.log("provider-ingress issuance owner-proof torture: GREEN");
console.log("LAW: PROVIDER INGRESS MAY NOT BORROW ENTITLEMENT-ISSUANCE AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE PRODUCTION ENTITLEMENT COMPOSER THAT OWNS THE PROOF MAY AUTHORIZE ISSUANCE.");
