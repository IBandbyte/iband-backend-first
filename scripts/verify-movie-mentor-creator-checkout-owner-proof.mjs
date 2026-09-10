import assert from "node:assert/strict";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionCreatorCommercialComposition} from "../ai/MovieMentorProductionCreatorCommercialComposition.js";

const authVerifier=Object.freeze({version:"1.0.0",domain:"iband.movie-mentor.journey-recovery-clerk-credential-verifier",provider:"clerk",algorithm:"RS256",networkMode:"pinned-public-key",authorizedParties:Object.freeze(["https://app.example.com"]),verifyCredential:async()=>({verified:true})});
const authentication=createMovieMentorProductionAuthenticationComposition({env:{MOVIE_MENTOR_CLERK_JWT_KEY:"PUBLIC",MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:'["https://app.example.com"]',MOVIE_MENTOR_CLERK_ISSUER:"issuer",MOVIE_MENTOR_AUDIENCE:"audience"},createVerifier:()=>authVerifier});
assert.equal(authentication.ready,true,"court requires genuine owner-proven authentication");

const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
let purchase;
try{
 purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"})});
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}
assert.equal(purchase.ready,true,"court requires genuine owner-proven purchase-intent authority so checkout provenance is isolated");

const forgedCheckoutStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,purchaseIntentOwnerProofRequired:true,explicitProviderRequired:true,ownerBoundProof:true,processLocalFallback:false});
const forgedCheckoutAuthority=Object.freeze({async initiateCheckout(){return Object.freeze({authorized:true});},getStatus:()=>forgedCheckoutStatus});
const catalogueStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-package-catalogue-authority",production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON"});
const packageCatalogueAuthority=Object.freeze({async listCommercialPackages(){return Object.freeze([]);},getStatus:()=>catalogueStatus});

assert.throws(
 ()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:purchase.authority,checkoutAuthority:forgedCheckoutAuthority,packageCatalogueAuthority}),
 error=>error?.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_CHECKOUT_REQUIRED",
 "creator commercial composition must reject a structurally perfect self-asserted checkout authority that does not own production checkout proof"
);

console.log("creator checkout owner-proof torture: GREEN");
console.log("LAW: THE CREATOR COMMERCIAL GATEWAY MAY NOT BORROW CHECKOUT AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE EXACT PRODUCTION-COMPOSED CHECKOUT AUTHORITY MAY CROSS INTO A PUBLIC CREATOR ROUTER.");
