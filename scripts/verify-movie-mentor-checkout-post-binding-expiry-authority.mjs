import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";
const intent={commercialIntentId:"intent-post-bind",principalId:"creator-1",packageId:"creator-20",provider:"provider-a",providerProductId:"price-20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1",policyDigest:"digest-v1",status:"created"};
let clock=0;const times=[new Date("2035-01-01T00:00:00.000Z"),new Date("2035-01-01T00:00:02.000Z")];
const authority=createMovieMentorCommercialCheckoutInitiationAuthority({resolvePurchaseIntent:async()=>intent,createProviderCheckout:async()=>({authorized:true,commercialIntentId:intent.commercialIntentId,provider:intent.provider,checkoutReference:"short-session",checkoutUrl:"https://checkout.example/short",expiresAt:"2035-01-01T00:00:01.000Z"}),checkoutBindingStore:{begin:async()=>({commercialIntentId:intent.commercialIntentId,provider:intent.provider,idempotencyKey:`movie-mentor:${intent.commercialIntentId}`,status:"pending"}),complete:async input=>({...input,status:"completed"}),resolve:async()=>null},now:()=>times[Math.min(clock++,times.length-1)]});
let result,error;try{result=await authority.initiateCheckout({principalId:intent.principalId,commercialIntentId:intent.commercialIntentId});}catch(e){error=e;}
assert.equal(result,undefined,"checkout session that expires across durable completion I/O must not reach creator-facing authority");
assert.equal(error?.code,"MOVIE_MENTOR_CHECKOUT_POST_BINDING_EXPIRED");
assert.ok(clock>=2,"fresh checkout must reassert time authority after durable completion before exposure");
console.log("GREEN: checkout expiry is reasserted after durable binding I/O before creator exposure.");
console.log("LAW: PRE-BINDING FRESHNESS DOES NOT OWN POST-BINDING CREATOR AUTHORITY.");
