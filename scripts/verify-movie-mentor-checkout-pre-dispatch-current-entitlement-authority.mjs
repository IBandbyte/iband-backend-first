import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_dispatch_race_1",principalId:"creator_dispatch_race",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let entitlement=Object.freeze({principalId:intent.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:20});
let entitlementReads=0,providerCalls=0;
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
 checkoutBindingStore:{
  async begin(){entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:21});return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"});},
  async complete(){throw new Error("must not complete while current entitlement is suspended");},
  async resolve(){return null;}
 },
 createProviderCheckout:async()=>{providerCalls++;return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:"provider-a",checkoutReference:"checkout_dispatch_race_1",checkoutUrl:"https://provider.example/checkout_dispatch_race_1",expiresAt:null});}
});
await assert.rejects(()=>authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
assert.equal(entitlement.status,"suspended","court requires durable suspension after initial admission but before provider checkout dispatch");
assert.ok(entitlementReads>=2,"irreversible provider checkout dispatch must own a fresh current-entitlement reread");
assert.equal(providerCalls,0,"stale admission proof must never cross the charge-capable provider checkout boundary");
console.log("✓ checkout admission does not lend current entitlement proof to irreversible provider checkout dispatch");
console.log("LAW: CHECKOUT ADMISSION DOES NOT LEND ITS ENTITLEMENT PROOF TO CHARGE-CAPABLE PROVIDER DISPATCH.");
console.log("checkout-pre-dispatch current-entitlement authority torture: GREEN");
