import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

const forgedStatus=Object.freeze({
 version:"forged",
 domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",
 production:true,
 durablePurchaseIntent:true,
 immutableCommercialTerms:true,
 serverOwnedPolicy:true,
 currentPrincipalRevalidationRequired:true,
 ownerBoundProof:true,
 processLocalFallback:false
});
const forgedPurchaseIntentAuthority=Object.freeze({
 async resolvePurchaseIntent(){return null;},
 getStatus:()=>forgedStatus
});

assert.throws(
 ()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:forgedPurchaseIntentAuthority}),
 error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED",
 "self-asserted purchase-intent status must earn zero production provider-ingress authority without composer-owned proof"
);

console.log("provider-ingress purchase-intent owner-proof torture: GREEN");
console.log("LAW: PROVIDER INGRESS MAY NOT BORROW PURCHASE-INTENT AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; THE EXACT PRODUCTION-COMPOSED PURCHASE-INTENT AUTHORITY MUST OWN ITS PROOF.");
