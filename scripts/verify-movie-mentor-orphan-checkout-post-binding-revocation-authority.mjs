import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_post_binding_orphan_1",principalId:"creator_post_binding_orphan",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let entitlement=Object.freeze({principalId:intent.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:80});
let providerSessionStatus="open",providerCalls=0,completeCalls=0,revokeCalls=0,entitlementReads=0;
const checkoutReference="checkout_post_binding_orphan_1";
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
 createProviderCheckout:async()=>{providerCalls++;return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:intent.provider,checkoutReference,checkoutUrl:`https://provider.example/${checkoutReference}`,expiresAt:null});},
 revokeProviderCheckout:async({provider,checkoutReference:ref})=>{assert.equal(provider,intent.provider);assert.equal(ref,checkoutReference);revokeCalls++;providerSessionStatus="expired";return Object.freeze({revoked:true,provider,checkoutReference:ref,status:"expired"});},
 checkoutBindingStore:{
  async begin(){return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:intent.provider,idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"});},
  async complete(){completeCalls++; entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:81});return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:intent.provider,idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"completed",checkoutReference,checkoutUrl:`https://provider.example/${checkoutReference}`,expiresAt:null});},
  async resolve(){return null;}
 }
});
let error=null;try{await authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId,currentPrincipalAuthority:async()=>({principalId:intent.principalId})});}catch(cause){error=cause;}
assert.equal(error?.code,"MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED","final creator-facing entitlement reread must still fail closed");
assert.equal(providerCalls,1,"court requires provider checkout creation before the race");
assert.equal(completeCalls,1,"court requires durable binding completion to cross after concurrent suspension");
assert.ok(entitlementReads>=4,"court requires final current-entitlement reread after durable completion");
assert.equal(entitlement.status,"suspended");
assert.equal(providerSessionStatus,"expired","a checkout that becomes orphaned by suspension across durable binding I/O must be explicitly revoked");
assert.equal(revokeCalls,1,"post-binding orphan checkout must cross provider revocation exactly once");
console.log("✓ suspension across durable binding I/O cannot abandon a newly-completed provider checkout open");
console.log("LAW: REVERSAL DISCOVERY MAY MISS A PENDING BINDING; FINAL CHECKOUT AUTHORITY MUST REVOKE THE SESSION IT ALREADY OWNS WHEN POST-BINDING ENTITLEMENT IS LOST.");
console.log("orphan-checkout post-binding revocation authority torture: GREEN");
