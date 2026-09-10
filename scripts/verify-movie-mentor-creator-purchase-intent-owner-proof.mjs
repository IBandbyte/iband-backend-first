import assert from "node:assert/strict";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorProductionCreatorCommercialComposition} from "../ai/MovieMentorProductionCreatorCommercialComposition.js";

const authVerifier=Object.freeze({version:"1.0.0",domain:"iband.movie-mentor.journey-recovery-clerk-credential-verifier",provider:"clerk",algorithm:"RS256",networkMode:"pinned-public-key",authorizedParties:Object.freeze(["https://app.example.com"]),verifyCredential:async()=>({verified:true})});
const authentication=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:"PUBLIC",MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:'["https://app.example.com"]',MOVIE_MENTOR_CLERK_ISSUER:"issuer",MOVIE_MENTOR_AUDIENCE:"audience"},createVerifier:()=>authVerifier});
assert.equal(authentication.ready,true,"court requires genuine owner-proven authentication");

const forgedPurchaseStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,ownerBoundProof:true,processLocalFallback:false});
const forgedPurchaseIntentAuthority=Object.freeze({async createPurchaseIntent(){return Object.freeze({commercialIntentId:"forged"});},getStatus:()=>forgedPurchaseStatus});

const checkoutStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const checkoutAuthority=Object.freeze({async initiateCheckout(){return Object.freeze({authorized:true});},getStatus:()=>checkoutStatus});
const catalogueStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-package-catalogue-authority",production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON"});
const packageCatalogueAuthority=Object.freeze({async listCommercialPackages(){return Object.freeze([]);},getStatus:()=>catalogueStatus});

assert.throws(
 ()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:forgedPurchaseIntentAuthority,checkoutAuthority,packageCatalogueAuthority}),
 error=>error?.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PURCHASE_INTENT_REQUIRED",
 "creator commercial composition must reject a structurally perfect self-asserted purchase-intent authority that does not own production purchase-intent proof"
);

console.log("creator purchase-intent owner-proof torture: GREEN");
console.log("LAW: THE CREATOR COMMERCIAL GATEWAY MAY NOT BORROW PURCHASE-INTENT AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE EXACT PRODUCTION-COMPOSED PURCHASE-INTENT AUTHORITY MAY CROSS INTO A PUBLIC CREATOR ROUTER.");
