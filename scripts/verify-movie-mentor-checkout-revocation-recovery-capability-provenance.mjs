import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutProviderRegistry} from "../ai/MovieMentorCommercialCheckoutProviderRegistry.js";

const status=Object.freeze({
 domain:"iband.movie-mentor.commercial-provider-adapter",
 provider:"stripe",
 productionCommercialProviderAdapter:true,
 checkoutTransport:true,
 checkoutRevocation:true,
 checkoutRevocationRecovery:false,
 serverOwnedIdempotencyRequired:true,
 creatorPayloadIsNotPaymentAuthority:true,
 processLocalFallback:false
});
const adapter=Object.freeze({
 createCheckout:async()=>{throw new Error("creation outside court");},
 revokeCheckout:async()=>Object.freeze({revoked:true,provider:"stripe",checkoutReference:"cs_1",status:"expired"}),
 getStatus:()=>status
});
assert.throws(
 ()=>createMovieMentorCommercialCheckoutProviderRegistry({providers:{stripe:adapter}}),
 error=>error?.code==="MOVIE_MENTOR_CHECKOUT_PROVIDER_INVALID",
 "production registry must reject an adapter that claims revocation but does not own uncertain-effect recovery capability"
);
console.log("✓ production checkout registry requires provider-owned revocation recovery provenance");
console.log("LAW: A CALLER MAY USE REVOCATION ONLY IF ITS PROVIDER PROVES RECOVERY OF UNCERTAIN REVOCATION REALITY.");
console.log("checkout revocation recovery capability provenance torture: GREEN");
