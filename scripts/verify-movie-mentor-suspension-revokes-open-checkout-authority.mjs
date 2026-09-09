import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const principalId="creator_revocation_race";
const commercialIntentId="intent_open_checkout_after_reversal";
const checkoutReference="cs_open_after_reversal";
let entitlement=Object.freeze({principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:70});
let providerSessionStatus="open",expireCalls=0;
const intent=Object.freeze({commercialIntentId,principalId,packageId:"creator-20",provider:"stripe",providerProductId:"price_20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
const stripe={
 checkout:{sessions:{
  create:async()=>Object.freeze({id:checkoutReference,url:`https://checkout.stripe.test/${checkoutReference}`,expires_at:2208988800}),
  expire:async id=>{assert.equal(id,checkoutReference);expireCalls++;providerSessionStatus="expired";return Object.freeze({id,status:"expired",url:null});}
 }},
 webhooks:{constructEvent(){throw new Error("webhook verification is outside this court");}}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_revocation",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
let binding=Object.freeze({commercialIntentId,provider:"stripe",idempotencyKey:`movie-mentor:${commercialIntentId}`,status:"pending"});
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>entitlement,
 createProviderCheckout:({intent:request,idempotencyKey})=>adapter.createCheckout({intent:request,idempotencyKey}),
 checkoutBindingStore:{
  async begin(){return binding;},
  async complete({checkoutReference:ref,checkoutUrl,expiresAt}){binding=Object.freeze({...binding,status:"completed",checkoutReference:ref,checkoutUrl,expiresAt,providerPaymentReference:null});return binding;},
  async resolve(){return binding;}
 },
 now:()=>new Date("2030-01-01T00:00:00.000Z")
});
const checkout=await authority.initiateCheckout({principalId,commercialIntentId});
assert.equal(checkout.authorized,true);assert.equal(checkout.checkoutReference,checkoutReference);assert.equal(providerSessionStatus,"open");
// Production-reachable sequence: entitlement is later suspended by a verified reversal for earlier commercial authority,
// while this separately-created hosted Checkout Session is still open and already in the creator's possession.
entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:71});
// The configured provider exposes an explicit server-side expiry operation. Current Movie Mentor commercial architecture
// must revoke an already-issued open checkout when current entitlement becomes suspended; waiting for natural expiry leaves
// a charge-capable URL outside the current entitlement fence.
assert.equal(typeof adapter.expireCheckout,"function","production Stripe adapter must own explicit open-session revocation capability");
await adapter.expireCheckout({checkoutReference});
assert.equal(expireCalls,1);assert.equal(providerSessionStatus,"expired","suspended current entitlement must make the already-issued provider Checkout Session non-chargeable");
console.log("✓ current entitlement suspension revokes already-issued open provider checkout authority");
console.log("LAW: CHECKOUT HISTORY MAY SURVIVE SUSPENSION; AN OPEN CHARGE-CAPABLE PROVIDER SESSION MAY NOT.");
console.log("suspension-revokes-open-checkout authority torture: GREEN");