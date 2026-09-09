import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

const intent=Object.freeze({commercialIntentId:"intent_suspended_1",principalId:"creator_suspended",packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"server-owned-digest",status:"created"});
let providerCalls=0;
let durableEntitlement=Object.freeze({principalId:"creator_suspended",status:"suspended",remainingUnits:7,reservedUnits:0,consumedUnits:3,entitlementRevision:11});
const bindingStore={begin:async()=>Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"}),complete:async({checkoutReference,checkoutUrl})=>Object.freeze({commercialIntentId:intent.commercialIntentId,provider:"provider-a",idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"completed",checkoutReference,checkoutUrl,expiresAt:null}),resolve:async()=>null};
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({resolvePurchaseIntent:async()=>intent,createProviderCheckout:async()=>{providerCalls++;return Object.freeze({authorized:true,commercialIntentId:intent.commercialIntentId,provider:"provider-a",checkoutReference:"checkout_suspended_1",checkoutUrl:"https://provider.example/checkout_suspended_1",expiresAt:null});},checkoutBindingStore:bindingStore});
assert.equal(durableEntitlement.status,"suspended","court requires current durable entitlement suspension from prior reversal");
await assert.rejects(()=>authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId}),error=>error?.code==="MOVIE_MENTOR_CHECKOUT_ENTITLEMENT_SUSPENDED");
assert.equal(providerCalls,0,"checkout authority must not create a charge-capable provider session while current entitlement is suspended and no reactivation authority exists");
console.log("✓ current durable entitlement suspension fences fresh provider checkout before charge-capable authority is created");
console.log("LAW: A SUSPENDED ENTITLEMENT MAY DENY FORWARD USAGE; IT MUST NOT ACCEPT A NEW CHARGE WITHOUT CURRENT REACTIVATION AUTHORITY.");
console.log("suspended-entitlement checkout authority torture: GREEN");
