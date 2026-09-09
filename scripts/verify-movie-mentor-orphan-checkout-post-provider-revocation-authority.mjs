import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_orphan_checkout_1",principalId:"creator_orphan_checkout",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let entitlement=Object.freeze({principalId:intent.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:50});
let providerCalls=0,completeCalls=0,revokeCalls=0;
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>entitlement,
 checkoutBindingStore:{
  async begin(){return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:intent.provider,idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"});},
  async complete(){completeCalls++;return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:intent.provider,idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"completed",checkoutReference:"checkout_orphan_1",checkoutUrl:"https://provider.example/checkout_orphan_1",expiresAt:null});},
  async resolve(){return null;}
 },
 createProviderCheckout:async()=>{providerCalls++;entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:51});return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:intent.provider,checkoutReference:"checkout_orphan_1",checkoutUrl:"https://provider.example/checkout_orphan_1",expiresAt:null});},
 revokeProviderCheckout:async({provider,checkoutReference})=>{revokeCalls++;assert.equal(provider,intent.provider);assert.equal(checkoutReference,"checkout_orphan_1");return Object.freeze({revoked:true,provider,checkoutReference,status:"expired"});}
});
await assert.rejects(()=>authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
assert.equal(providerCalls,1,"court requires charge-capable provider checkout creation before suspension is observed");
assert.equal(completeCalls,0,"suspended entitlement must not gain durable creator-facing checkout completion");
assert.equal(revokeCalls,1,"provider checkout created before post-provider suspension discovery must be revoked before the authority exits");
console.log("✓ post-provider suspension revokes the newly created orphan checkout before failing closed");
console.log("LAW: CREATOR-FACING AUTHORITY MAY FAIL CLOSED AFTER PROVIDER CREATION; THE NEWLY CREATED CHARGE-CAPABLE PROVIDER SESSION MAY NOT BE ABANDONED OPEN.");
console.log("orphan checkout post-provider revocation authority torture: GREEN");
