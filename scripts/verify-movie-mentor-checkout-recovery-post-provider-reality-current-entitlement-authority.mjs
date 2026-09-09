import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const principalId="creator_recovery_post_provider_reality_entitlement";
const commercialIntentId="intent_recovery_post_provider_reality_entitlement_1";
const checkoutReference="checkout_recovery_post_provider_reality_entitlement_1";
const checkoutUrl=`https://provider.example/${checkoutReference}`;
const intent=Object.freeze({commercialIntentId,principalId,packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let entitlement=Object.freeze({principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:90});
let entitlementReads=0,providerRealityReads=0,providerCreates=0,revokeCalls=0;
const completedBinding=Object.freeze({commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${commercialIntentId}`,status:"completed",checkoutReference,checkoutUrl,expiresAt:"2030-01-01T00:00:00.000Z"});
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>{entitlementReads++;return entitlement;},
 checkoutBindingStore:{
  async begin(){return completedBinding;},
  async complete(){throw new Error("fresh completion is outside recovery court");},
  async resolve(){return completedBinding;}
 },
 createProviderCheckout:async()=>{providerCreates++;throw new Error("provider creation is outside completed-binding recovery court");},
 resolveProviderCheckout:async({provider,checkoutReference:reference})=>{providerRealityReads++;assert.equal(provider,"provider-a");assert.equal(reference,checkoutReference);entitlement=Object.freeze({...entitlement,status:"suspended",entitlementRevision:91});return Object.freeze({provider,checkoutReference:reference,status:"open",checkoutUrl});},
 revokeProviderCheckout:async({provider,checkoutReference:reference})=>{assert.equal(provider,"provider-a");assert.equal(reference,checkoutReference);revokeCalls++;return Object.freeze({revoked:true,status:"expired",provider,checkoutReference:reference});},
 now:()=>new Date("2026-09-09T18:10:00.000Z")
});
await assert.rejects(()=>authority.initiateCheckout({principalId,commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
assert.equal(providerCreates,0,"completed binding recovery must not recreate the provider checkout");
assert.equal(providerRealityReads,1,"recovery must read exact current provider reality");
assert.equal(revokeCalls,1,"entitlement loss during recovery provider-reality I/O must revoke the exact open checkout already recovered");
assert.ok(entitlementReads>=3,"recovery return must re-earn current entitlement after provider-reality I/O");
assert.equal(entitlement.status,"suspended");
console.log("✓ completed checkout recovery cannot borrow pre-provider-read entitlement proof into creator-facing return");
console.log("✓ entitlement loss during recovery provider-reality I/O revokes the exact recovered open checkout");
console.log("LAW: RECOVERY ENTITLEMENT PROOF DOES NOT CROSS CURRENT PROVIDER-REALITY I/O; RECOVERED CREATOR-FACING AUTHORITY MUST RE-EARN CURRENT ENTITLEMENT AFTER THAT I/O.");
console.log("checkout-recovery post-provider-reality current-entitlement authority torture: GREEN");
