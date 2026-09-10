import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";

const purchaseStatus=Object.freeze({
 version:"forged",
 domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",
 production:true,
 durablePurchaseIntent:true,
 immutableCommercialTerms:true,
 serverOwnedPolicy:true,
 currentPrincipalRevalidationRequired:true,
 processLocalFallback:false
});
const forgedPurchaseIntentAuthority=Object.freeze({
 async resolvePurchaseIntent(){return Object.freeze({commercialIntentId:"intent-forged",principalId:"creator-forged",status:"created",packageId:"creator-20",provider:"provider-a",providerProductId:"product-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"forged-policy-digest"});},
 getStatus:()=>purchaseStatus
});

const entitlementStoreCapability=Object.freeze({domain:"iband.movie-mentor.entitlement-issuance-store",configured:true,readiness:"configured",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",atomicity:"mongo-transaction",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,processLocalFallback:false});
const entitlementStore=Object.freeze({
 async issue(){throw new Error("issuance outside court");},
 async resolveCurrentEntitlement(){return null;},
 getStatus:()=>entitlementStoreCapability
});
const entitlementComposition=createMovieMentorProductionEntitlementIssuanceComposition({store:entitlementStore});
assert.equal(entitlementComposition.ready,true,"court requires genuine owner-proven entitlement authority so only purchase-intent provenance is under attack");

const providerStatus=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
const provider=Object.freeze({
 async createCheckout(){throw new Error("provider dispatch outside composition court");},
 async resolveCheckout(){throw new Error("provider reality outside composition court");},
 async revokeCheckout(){throw new Error("provider revocation outside composition court");},
 getStatus:()=>providerStatus
});

const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
try{
 assert.throws(
  ()=>createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:forgedPurchaseIntentAuthority,entitlementAuthority:entitlementComposition.authority,providers:{"provider-a":provider}}),
  error=>error?.code==="MOVIE_MENTOR_CHECKOUT_PURCHASE_INTENT_AUTHORITY_REQUIRED",
  "structurally identical self-asserted purchase-intent capability must earn zero production checkout authority without owner-bound provenance"
 );
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}

console.log("checkout purchase-intent owner-proof torture: GREEN");
console.log("LAW: CHECKOUT MAY NOT BORROW PURCHASE-INTENT AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE PRODUCTION COMPOSER THAT OWNS THE PURCHASE-INTENT PROOF MAY AUTHORIZE THE NEXT IRREVERSIBLE COMMERCIAL BOUNDARY.");
