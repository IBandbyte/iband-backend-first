import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
try{
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>Object.freeze({packageId:"creator-20",provider:"stripe",providerProductId:"price-20",amountMinor:2000,currency:"GBP",environment:"live",units:20,policyVersion:"v1"})});
 assert.equal(purchase.ready,true,"court requires genuine owner-proven purchase-intent authority so only checkout provenance is under attack");

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

 assert.throws(
  ()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:forgedCheckoutAuthority}),
  error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_CHECKOUT_BINDING_REQUIRED",
  "self-asserted checkout binding capability must earn zero provider-ingress payment-lineage authority without checkout-composer ownership proof"
 );
}finally{
 if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;
}

console.log("provider-ingress checkout owner-proof torture: GREEN");
console.log("LAW: PROVIDER INGRESS MAY NOT BORROW CHECKOUT OR PAYMENT-LINEAGE AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; THE EXACT PRODUCTION-COMPOSED CHECKOUT AUTHORITY MUST OWN ITS PROOF.");
