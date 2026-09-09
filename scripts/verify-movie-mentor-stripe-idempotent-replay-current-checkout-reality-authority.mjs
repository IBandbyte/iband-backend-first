import assert from "node:assert/strict";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const commercialIntentId="intent_stripe_idempotent_replay_reality";
let createCalls=0;
const stripe={
  checkout:{sessions:{
    create:async()=>{createCalls+=1;return {id:"cs_replayed_expired",url:"https://checkout.stripe.invalid/replayed",status:"expired",payment_status:"unpaid",expires_at:1893456000};},
    expire:async ref=>({id:ref,status:"expired"}),
    retrieve:async ref=>({id:ref,status:"expired",url:null})
  }},
  webhooks:{constructEvent:()=>({})}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_test",successUrl:"https://movie-mentor.invalid/success",cancelUrl:"https://movie-mentor.invalid/cancel"});
const intent=Object.freeze({commercialIntentId,provider:"stripe",providerProductId:"price_creator20",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"v1",policyDigest:"digest"});
await assert.rejects(
  ()=>adapter.createCheckout({intent,idempotencyKey:`movie-mentor:${commercialIntentId}`}),
  error=>error?.code==="MOVIE_MENTOR_STRIPE_CHECKOUT_NOT_OPEN"
);
assert.equal(createCalls,1,"court requires exact provider checkout response to be inspected once");
console.log("Movie Mentor Stripe idempotent replay current checkout reality authority GREEN");
console.log("LAW: SERVER IDEMPOTENCY MAY REPLAY PROVIDER HISTORY; A NON-OPEN CHECKOUT MAY NOT REGAIN CREATOR-FACING CHARGE AUTHORITY.");
