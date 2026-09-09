import assert from "node:assert/strict";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const checkoutReference="cs_revocation_ack_loss_1";
let providerStatus="open";
let expireCalls=0;
let retrieveCalls=0;
const stripe={
 checkout:{sessions:{
  create:async()=>{throw new Error("checkout creation is outside this court");},
  expire:async id=>{assert.equal(id,checkoutReference);expireCalls++;providerStatus="expired";const error=new Error("transport lost after Stripe committed session expiry");error.code="ECONNRESET";throw error;},
  retrieve:async id=>{assert.equal(id,checkoutReference);retrieveCalls++;return Object.freeze({id,status:providerStatus,url:null});}
 }},
 webhooks:{constructEvent(){throw new Error("webhook verification is outside this court");}}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_revocation_recovery",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
const result=await adapter.revokeCheckout({checkoutReference});
assert.equal(providerStatus,"expired","court requires provider-side revocation to have committed despite lost response");
assert.equal(expireCalls,1,"revocation effect must be attempted exactly once before recovery read");
assert.equal(retrieveCalls,1,"uncertain revocation must recover exact provider-side session reality instead of blindly retrying the irreversible effect");
assert.equal(result.revoked,true);
assert.equal(result.checkoutReference,checkoutReference);
assert.equal(result.status,"expired");
assert.equal(result.recovered,true,"ACK-loss recovery must be explicit in the provider-owned result");
assert.equal(adapter.getStatus().checkoutRevocationRecovery,true,"provider adapter must own revocation-reality recovery capability proof");
console.log("✓ lost Stripe expiry acknowledgement recovers exact provider-side session reality without replaying the irreversible revocation effect");
console.log("LAW: A LOST REVOCATION ACK MAY HIDE A COMPLETED PROVIDER EFFECT; RETRY MUST RECOVER REALITY BEFORE REPLAYING AUTHORITY.");
console.log("stripe checkout revocation recovery authority torture: GREEN");
