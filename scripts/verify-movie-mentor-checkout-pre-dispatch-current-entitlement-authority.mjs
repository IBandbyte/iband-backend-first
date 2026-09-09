import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

function intent(id,principal){return Object.freeze({commercialIntentId:id,principalId:principal,packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});}

{
 const purchase=intent("intent_dispatch_race_1","creator_dispatch_race");
 let entitlement=Object.freeze({principalId:purchase.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:20});
 let entitlementReads=0,providerCalls=0;
 const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
  resolvePurchaseIntent:async()=>purchase,
  resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
  checkoutBindingStore:{
   async begin(){entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:21});return Object.freeze({commercialIntentId:purchase.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${purchase.commercialIntentId}`,status:"pending"});},
   async complete(){throw new Error("must not complete while current entitlement is suspended");},
   async resolve(){return null;}
  },
  createProviderCheckout:async()=>{providerCalls++;return Object.freeze({authorized:true,commercialIntentId:purchase.commercialIntentId,provider:"provider-a",checkoutReference:"checkout_dispatch_race_1",checkoutUrl:"https://provider.example/checkout_dispatch_race_1",expiresAt:null});}
 });
 await assert.rejects(()=>authority.initiateCheckout({principalId:purchase.principalId,commercialIntentId:purchase.commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
 assert.equal(entitlement.status,"suspended");
 assert.ok(entitlementReads>=2,"irreversible provider checkout dispatch must own a fresh current-entitlement reread");
 assert.equal(providerCalls,0,"stale admission proof must never cross charge-capable provider dispatch");
}

{
 const purchase=intent("intent_recovery_race_1","creator_recovery_race");
 let entitlement=Object.freeze({principalId:purchase.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:30});
 let entitlementReads=0;
 const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
  resolvePurchaseIntent:async()=>purchase,
  resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
  checkoutBindingStore:{
   async begin(){entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:31});return Object.freeze({commercialIntentId:purchase.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${purchase.commercialIntentId}`,status:"completed",checkoutReference:"checkout_recovery_race_1",checkoutUrl:"https://provider.example/checkout_recovery_race_1",expiresAt:"2035-01-01T00:00:00.000Z"});},
   async complete(){throw new Error("completed recovery must not write");},
   async resolve(){return null;}
  },
  createProviderCheckout:async()=>{throw new Error("completed recovery must not create another provider checkout");},
  now:()=>new Date("2030-01-01T00:00:00.000Z")
 });
 await assert.rejects(()=>authority.initiateCheckout({principalId:purchase.principalId,commercialIntentId:purchase.commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
 assert.ok(entitlementReads>=2,"recovered creator-facing checkout authority must also own a fresh current-entitlement reread after binding I/O");
}

console.log("✓ checkout admission does not lend current entitlement proof across durable checkout binding I/O");
console.log("✓ fresh provider dispatch and recovered checkout authority both fail closed if suspension becomes current after admission");
console.log("LAW: CHECKOUT ADMISSION DOES NOT LEND ITS ENTITLEMENT PROOF TO CHARGE-CAPABLE PROVIDER DISPATCH OR RECOVERY.");
console.log("checkout-pre-dispatch current-entitlement authority torture: GREEN");
