import assert from "node:assert/strict";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const commercialIntentId="intent_async_1";
const checkoutReference="cs_async_1";
const providerPaymentReference="pi_async_1";
const event=Object.freeze({
 id:"evt_async_success_1",
 type:"checkout.session.async_payment_succeeded",
 livemode:true,
 data:{object:{
  id:checkoutReference,
  client_reference_id:commercialIntentId,
  payment_intent:providerPaymentReference,
  metadata:{commercialIntentId,providerProductId:"price_async_20"},
  payment_status:"paid",
  amount_total:1200,
  currency:"gbp"
 }}
});
const stripe={
 checkout:{sessions:{create:async()=>{throw new Error("checkout creation is outside this court");}}},
 webhooks:{constructEvent(){return event;}}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({
 stripe,
 webhookSecret:"whsec_async",
 successUrl:"https://app.example/success",
 cancelUrl:"https://app.example/cancel"
});
const verified=await adapter.verifyDelivery({delivery:{rawBody:Buffer.from("signed-async-success"),signature:"sig"}});
const normalized=await adapter.normalizeEvent({verifiedDelivery:verified});
assert.equal(normalized.provider,"stripe");
assert.equal(normalized.eventId,"evt_async_success_1");
assert.equal(normalized.eventKind,"checkout.session.async_payment_succeeded");
assert.equal(normalized.commercialIntentId,commercialIntentId);
assert.equal(normalized.checkoutReference,checkoutReference);
assert.equal(normalized.providerPaymentReference,providerPaymentReference);
assert.equal(normalized.providerProductId,"price_async_20");
assert.equal(normalized.amountMinor,1200);
assert.equal(normalized.currency,"GBP");
assert.equal(normalized.environment,"live");
assert.equal(normalized.commercialReversal,false);
assert.equal(normalized.commerciallyFinal,true,"a provider-verified async Checkout payment success carrying payment_status=paid must be eligible for normal commercial evidence verification and entitlement issuance");
console.log("✓ verified Stripe asynchronous checkout payment success preserves exact commercial coordinates");
console.log("✓ provider-confirmed paid async checkout reality becomes commercially final instead of remaining permanently non-final");
console.log("LAW: PAYMENT METHOD LATENCY MAY DELAY COMMERCIAL FINALITY; PROVIDER-CONFIRMED PAID REALITY MAY NOT BE DISCARDED BECAUSE IT ARRIVED ON AN ASYNC SUCCESS EVENT.");
console.log("stripe async payment finality authority torture: GREEN");