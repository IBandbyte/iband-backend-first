import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_post_binding_provider_reality_1",principalId:"creator_post_binding_provider_reality",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
const entitlement=Object.freeze({principalId:intent.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:70});
let providerCreates=0,providerRealityReads=0,completeCalls=0;
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>entitlement,
 checkoutBindingStore:{
  async begin(){return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"});},
  async complete(){completeCalls++;return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"completed",checkoutReference:"checkout_post_binding_provider_reality_1",checkoutUrl:"https://provider.example/checkout_post_binding_provider_reality_1",expiresAt:"2030-01-01T00:00:00.000Z"});},
  async resolve(){return null;}
 },
 createProviderCheckout:async()=>{providerCreates++;return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:"provider-a",checkoutReference:"checkout_post_binding_provider_reality_1",checkoutUrl:"https://provider.example/checkout_post_binding_provider_reality_1",expiresAt:"2030-01-01T00:00:00.000Z"});},
 resolveProviderCheckout:async({provider,checkoutReference})=>{providerRealityReads++;assert.equal(provider,"provider-a");assert.equal(checkoutReference,"checkout_post_binding_provider_reality_1");return Object.freeze({provider,checkoutReference,checkoutUrl:"https://provider.example/checkout_post_binding_provider_reality_1",status:"expired"});},
 now:()=>new Date("2026-09-09T17:20:00.000Z")
});
await assert.rejects(()=>authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId,currentPrincipalAuthority:async()=>({principalId:intent.principalId})}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_POST_BINDING_PROVIDER_NOT_OPEN");
assert.equal(providerCreates,1,"court requires a fresh provider checkout to have been created open before durable binding I/O");
assert.equal(completeCalls,1,"court requires durable binding completion before provider reality changes");
assert.equal(providerRealityReads,1,"creator-facing return must re-earn current provider reality after durable binding completion");
console.log("✓ fresh provider creation history cannot lend open-provider proof across durable binding I/O");
console.log("LAW: PROVIDER CREATION MAY PROVE THE SESSION WAS OPEN THEN; CREATOR-FACING RETURN MUST RE-EARN CURRENT OPEN PROVIDER REALITY AFTER DURABLE BINDING I/O.");
console.log("checkout-post-binding current-provider-reality authority torture: GREEN");
