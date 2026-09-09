import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_post_binding_race_1",principalId:"creator_post_binding_race",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let entitlement=Object.freeze({principalId:intent.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:50});
let entitlementReads=0,providerCalls=0,completeCalls=0,revokeCalls=0;
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
 checkoutBindingStore:{
  async begin(){return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"});},
  async complete(){completeCalls++;entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:51});return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"completed",checkoutReference:"checkout_post_binding_race_1",checkoutUrl:"https://provider.example/checkout_post_binding_race_1",expiresAt:null});},
  async resolve(){return null;}
 },
 createProviderCheckout:async()=>{providerCalls++;return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:"provider-a",checkoutReference:"checkout_post_binding_race_1",checkoutUrl:"https://provider.example/checkout_post_binding_race_1",expiresAt:null});},
 revokeProviderCheckout:async({provider,checkoutReference})=>{assert.equal(provider,"provider-a");assert.equal(checkoutReference,"checkout_post_binding_race_1");revokeCalls++;return Object.freeze({revoked:true,provider,checkoutReference,status:"expired"});}
});
await assert.rejects(()=>authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId,currentPrincipalAuthority:async()=>({principalId:intent.principalId})}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
assert.equal(providerCalls,1,"court requires provider checkout history to exist");
assert.equal(completeCalls,1,"court requires durable checkout completion to finish before concurrent suspension becomes visible");
assert.equal(revokeCalls,1,"post-binding suspension must revoke the exact provider session already owned by checkout initiation");
assert.ok(entitlementReads>=4,"creator-facing return must own a fresh current-entitlement reread after durable binding completion");
assert.equal(entitlement.status,"suspended");
console.log("✓ durable checkout completion may survive as history without lending stale current entitlement to creator-facing return");
console.log("✓ post-binding suspension revokes the exact provider checkout session already owned by checkout initiation");
console.log("LAW: DURABLE CHECKOUT COMPLETION DOES NOT LEND PRE-BINDING ENTITLEMENT PROOF TO CREATOR-FACING AUTHORITY.");
console.log("checkout-post-binding current-entitlement authority torture: GREEN");
