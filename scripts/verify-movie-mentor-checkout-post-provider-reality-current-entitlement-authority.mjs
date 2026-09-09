import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_post_provider_reality_entitlement_1",principalId:"creator_post_provider_reality_entitlement",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let entitlement=Object.freeze({principalId:intent.principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:80});
let providerCreates=0,providerRealityReads=0,completeCalls=0,revokeCalls=0,entitlementReads=0;
const checkoutReference="checkout_post_provider_reality_entitlement_1";
const checkoutUrl=`https://provider.example/${checkoutReference}`;
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
 checkoutBindingStore:{
  async begin(){return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"});},
  async complete(){completeCalls++;return Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"completed",checkoutReference,checkoutUrl,expiresAt:"2030-01-01T00:00:00.000Z"});},
  async resolve(){return null;}
 },
 createProviderCheckout:async()=>{providerCreates++;return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:"provider-a",checkoutReference,checkoutUrl,expiresAt:"2030-01-01T00:00:00.000Z"});},
 resolveProviderCheckout:async({provider,checkoutReference:reference})=>{providerRealityReads++;assert.equal(provider,"provider-a");assert.equal(reference,checkoutReference);entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:81});return Object.freeze({provider,checkoutReference:reference,status:"open",checkoutUrl});},
 revokeProviderCheckout:async({provider,checkoutReference:reference})=>{assert.equal(provider,"provider-a");assert.equal(reference,checkoutReference);revokeCalls++;return Object.freeze({revoked:true,provider,checkoutReference:reference,status:"expired"});},
 now:()=>new Date("2026-09-09T18:00:00.000Z")
});
await assert.rejects(()=>authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
assert.equal(providerCreates,1,"court requires a fresh provider checkout to exist");
assert.equal(completeCalls,1,"court requires durable binding completion before creator exposure");
assert.equal(providerRealityReads,1,"court requires current provider-open proof to be re-earned after binding");
assert.equal(revokeCalls,1,"entitlement loss during provider-reality I/O must revoke the exact charge-capable checkout already owned");
assert.ok(entitlementReads>=5,"creator-facing return must re-earn current entitlement after provider-reality I/O");
assert.equal(entitlement.status,"suspended");
console.log("✓ current provider-open proof may survive as reality without lending stale entitlement proof to creator-facing return");
console.log("✓ entitlement loss during provider-reality I/O revokes the exact checkout already owned by initiation");
console.log("LAW: POST-BINDING ENTITLEMENT PROOF DOES NOT CROSS CURRENT PROVIDER-REALITY I/O; CREATOR-FACING RETURN MUST RE-EARN CURRENT ENTITLEMENT AFTER THAT I/O.");
console.log("checkout-post-provider-reality current-entitlement authority torture: GREEN");
