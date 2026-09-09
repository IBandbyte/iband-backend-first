import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const principalId="creator_recovered_provider_reality";
const commercialIntentId="intent_recovered_provider_reality";
const checkoutReference="cs_recovered_expired_1";
let providerRealityReads=0;
const intent=Object.freeze({commercialIntentId,principalId,packageId:"creator-20",provider:"stripe",providerProductId:"price_20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"digest",status:"created"});
const completedBinding=Object.freeze({commercialIntentId,provider:"stripe",idempotencyKey:`movie-mentor:${commercialIntentId}`,status:"completed",checkoutReference,checkoutUrl:`https://checkout.stripe.test/${checkoutReference}`,expiresAt:"2099-01-01T00:00:00.000Z",providerPaymentReference:null});
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
 resolvePurchaseIntent:async()=>intent,
 resolveCurrentEntitlement:async()=>Object.freeze({principalId,status:"active",entitlementRevision:5}),
 createProviderCheckout:async()=>{throw new Error("provider creation must not occur on completed binding recovery");},
 resolveProviderCheckout:async({provider,checkoutReference:ref})=>{assert.equal(provider,"stripe");assert.equal(ref,checkoutReference);providerRealityReads++;return Object.freeze({provider:"stripe",checkoutReference:ref,status:"expired",checkoutUrl:null});},
 checkoutBindingStore:{begin:async()=>completedBinding,complete:async()=>{throw new Error("completion outside recovery court");},resolve:async()=>completedBinding},
 now:()=>new Date("2030-01-01T00:00:00.000Z")
});
await assert.rejects(
 ()=>authority.initiateCheckout({principalId,commercialIntentId}),
 error=>error?.code==="MOVIE_MENTOR_CHECKOUT_RECOVERY_PROVIDER_NOT_OPEN"
);
assert.equal(providerRealityReads,1,"completed binding recovery must re-earn current provider checkout reality exactly once");
console.log("Movie Mentor checkout recovery current provider reality authority GREEN");
console.log("LAW: DURABLE CHECKOUT HISTORY MAY SURVIVE; RECOVERY MAY NOT RETURN CREATOR-FACING CHECKOUT AUTHORITY WITHOUT CURRENT OPEN PROVIDER REALITY.");
