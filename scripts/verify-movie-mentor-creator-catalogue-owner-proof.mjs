import assert from "node:assert/strict";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCreatorCommercialComposition} from "../ai/MovieMentorProductionCreatorCommercialComposition.js";

const authVerifier=Object.freeze({version:"1.0.0",domain:"iband.movie-mentor.journey-recovery-clerk-credential-verifier",provider:"clerk",algorithm:"RS256",networkMode:"pinned-public-key",authorizedParties:Object.freeze(["https://app.example.com"]),verifyCredential:async()=>({verified:true})});
const authentication=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:"PUBLIC",MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:'["https://app.example.com"]',MOVIE_MENTOR_CLERK_ISSUER:"issuer",MOVIE_MENTOR_AUDIENCE:"audience"},createVerifier:()=>authVerifier});
assert.equal(authentication.ready,true,"court requires genuine owner-proven authentication");

const entitlementStoreStatus=Object.freeze({domain:"iband.movie-mentor.entitlement-issuance-store",configured:true,atomicity:"mongo-transaction",entitlementCollection:"movie_mentor_inference_entitlement",issuanceCollection:"movie_mentor_entitlement_issuance",evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,processLocalFallback:false});
const entitlementStore=Object.freeze({async issue(){throw new Error("issuance outside catalogue court");},async resolveCurrentEntitlement(){return null;},getStatus:()=>entitlementStoreStatus});
const entitlement=createMovieMentorProductionEntitlementIssuanceComposition({store:entitlementStore});
assert.equal(entitlement.ready,true,"court requires genuine owner-proven current entitlement authority");

const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
let purchase,checkout;
try{
 purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"})});
 const providerStatus=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,checkoutRevocation:true,checkoutRevocationRecovery:true,currentCheckoutReality:true,serverOwnedIdempotencyRequired:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
 const provider=Object.freeze({async createCheckout(){throw new Error("checkout dispatch outside catalogue court");},async resolveCheckout(){throw new Error("checkout reality outside catalogue court");},async revokeCheckout(){throw new Error("checkout revocation outside catalogue court");},getStatus:()=>providerStatus});
 checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:entitlement.authority,providers:{"provider-a":provider}});
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}
assert.equal(purchase.ready,true,"court requires genuine owner-proven purchase-intent authority");
assert.equal(checkout.ready,true,"court requires genuine owner-proven checkout authority so catalogue provenance is isolated");

const forgedCatalogueStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-package-catalogue-authority",production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON",ownerBoundProof:true,processLocalFallback:false});
const forgedCatalogueAuthority=Object.freeze({listCommercialPackages:()=>Object.freeze([]),getStatus:()=>forgedCatalogueStatus});

assert.throws(
 ()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:purchase.authority,checkoutAuthority:checkout.authority,packageCatalogueAuthority:forgedCatalogueAuthority}),
 error=>error?.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PACKAGE_CATALOGUE_REQUIRED",
 "creator commercial composition must reject a structurally perfect self-asserted catalogue authority that does not own production catalogue proof"
);

console.log("creator catalogue owner-proof torture: GREEN");
console.log("LAW: THE CREATOR COMMERCIAL GATEWAY MAY NOT BORROW PACKAGE OR PRICE AUTHORITY FROM A SELF-ASSERTED CATALOGUE STATUS; ONLY THE EXACT PRODUCTION POLICY COMPOSER MAY AUTHORIZE WHAT THE CREATOR CAN BUY.");
