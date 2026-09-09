import assert from "node:assert/strict";
import {createMovieMentorCommercialCheckoutInitiationAuthority} from "../ai/MovieMentorCommercialCheckoutInitiationAuthority.js";

let currentTime=new Date("2030-01-01T00:00:00.000Z");
let authReads=0;
let providerCreates=0;

async function currentPrincipalAuthority(){
  authReads++;
  if(currentTime.getTime()>=Date.parse("2030-01-01T00:00:05.000Z")){
    const error=new Error("credential expired before irreversible provider checkout dispatch");
    error.code="MOVIE_MENTOR_AUTH_EXPIRED";
    throw error;
  }
  return Object.freeze({principalId:"creator-checkout-auth"});
}

const authority=createMovieMentorCommercialCheckoutInitiationAuthority({
  resolvePurchaseIntent:async()=>Object.freeze({
    commercialIntentId:"intent-checkout-auth-1",
    principalId:"creator-checkout-auth",
    status:"created",
    packageId:"creator-20",
    provider:"provider-a",
    providerProductId:"prod-20",
    amountMinor:2000,
    currency:"GBP",
    environment:"live",
    units:20,
    policyVersion:"v1",
    policyDigest:"digest-1"
  }),
  resolveCurrentEntitlement:async()=>Object.freeze({principalId:"creator-checkout-auth",status:"active",entitlementRevision:1}),
  createProviderCheckout:async()=>{providerCreates++;return Object.freeze({authorized:true,commercialIntentId:"intent-checkout-auth-1",provider:"provider-a",checkoutReference:"checkout-auth-1",checkoutUrl:"https://checkout.example/auth-1",expiresAt:"2030-01-01T00:30:00.000Z"});},
  resolveProviderCheckout:async()=>Object.freeze({provider:"provider-a",checkoutReference:"checkout-auth-1",status:"open",checkoutUrl:"https://checkout.example/auth-1"}),
  revokeProviderCheckout:async()=>{},
  checkoutBindingStore:{
    async begin(){currentTime=new Date("2030-01-01T00:00:06.000Z");return Object.freeze({status:"pending",provider:"provider-a",idempotencyKey:"movie-mentor:intent-checkout-auth-1"});},
    async complete({checkoutReference,checkoutUrl,provider,idempotencyKey}){return Object.freeze({status:"completed",provider,idempotencyKey,checkoutReference,checkoutUrl,expiresAt:"2030-01-01T00:30:00.000Z"});},
    async resolve(){return null;}
  }
});

await assert.rejects(
  ()=>authority.initiateCheckout({principalId:"creator-checkout-auth",commercialIntentId:"intent-checkout-auth-1",currentPrincipalAuthority}),
  error=>error?.code==="MOVIE_MENTOR_AUTH_EXPIRED"
);
assert.equal(authReads,1,"irreversible provider checkout dispatch must re-earn current authentication after checkout binding I/O");
assert.equal(providerCreates,0,"expired authentication must prevent provider checkout creation");
console.log("✓ ingress authentication cannot cross checkout binding I/O into irreversible provider checkout creation");
console.log("✓ current principal authority is re-earned immediately before provider dispatch");
console.log("LAW: INGRESS AUTHENTICATION DOES NOT LEND ITS PROOF TO IRREVERSIBLE PROVIDER CHECKOUT CREATION; PROVIDER DISPATCH MUST RE-EARN CURRENT PRINCIPAL AUTHORITY.");
console.log("checkout pre-dispatch current-auth torture: GREEN");
