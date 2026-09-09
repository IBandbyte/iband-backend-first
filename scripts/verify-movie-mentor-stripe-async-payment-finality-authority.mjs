import assert from "node:assert/strict";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const commercialIntentId="intent_async_1";
const checkoutReference="cs_async_1";
const providerPaymentReference="pi_async_1";
function sessionEvent({id,type,paymentStatus}){return Object.freeze({id,type,livemode:true,data:{object:{id:checkoutReference,client_reference_id:commercialIntentId,payment_intent:providerPaymentReference,metadata:{commercialIntentId,providerProductId:"price_async_20"},payment_status:paymentStatus,amount_total:1200,currency:"gbp"}}});}
let currentEvent=sessionEvent({id:"evt_async_success_1",type:"checkout.session.async_payment_succeeded",paymentStatus:"paid"});
const stripe={checkout:{sessions:{create:async()=>{throw new Error("checkout creation is outside this court");}}},webhooks:{constructEvent(){return currentEvent;}}};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_async",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
async function normalize(label){const verified=await adapter.verifyDelivery({delivery:{rawBody:Buffer.from(label),signature:"sig"}});return adapter.normalizeEvent({verifiedDelivery:verified});}
const normalized=await normalize("signed-async-success");
assert.equal(normalized.provider,"stripe");assert.equal(normalized.eventId,"evt_async_success_1");assert.equal(normalized.eventKind,"checkout.session.async_payment_succeeded");assert.equal(normalized.commercialIntentId,commercialIntentId);assert.equal(normalized.checkoutReference,checkoutReference);assert.equal(normalized.providerPaymentReference,providerPaymentReference);assert.equal(normalized.providerProductId,"price_async_20");assert.equal(normalized.amountMinor,1200);assert.equal(normalized.currency,"GBP");assert.equal(normalized.environment,"live");assert.equal(normalized.commercialReversal,false);assert.equal(normalized.commerciallyFinal,true,"a provider-verified async Checkout payment success carrying payment_status=paid must be eligible for normal commercial evidence verification and entitlement issuance");
currentEvent=sessionEvent({id:"evt_async_failed_1",type:"checkout.session.async_payment_failed",paymentStatus:"unpaid"});
const failed=await normalize("signed-async-failure");assert.equal(failed.eventKind,"checkout.session.async_payment_failed");assert.equal(failed.commerciallyFinal,false,"async payment failure must never mint payment or entitlement authority");assert.equal(failed.commercialReversal,false,"payment failure is not a refund/dispute reversal of previously earned entitlement authority");
currentEvent=sessionEvent({id:"evt_completed_unpaid_1",type:"checkout.session.completed",paymentStatus:"unpaid"});
const incomplete=await normalize("signed-completed-unpaid");assert.equal(incomplete.eventKind,"checkout.session.completed");assert.equal(incomplete.commerciallyFinal,false,"Checkout completion without paid provider reality must remain non-final");
console.log("✓ verified Stripe asynchronous checkout payment success preserves exact commercial coordinates");
console.log("✓ provider-confirmed paid async checkout reality becomes commercially final while failed/unpaid checkout reality remains non-final");
console.log("LAW: PAYMENT METHOD LATENCY MAY DELAY COMMERCIAL FINALITY; PROVIDER-CONFIRMED PAID REALITY MAY NOT BE DISCARDED BECAUSE IT ARRIVED ON AN ASYNC SUCCESS EVENT.");
console.log("stripe async payment finality authority torture: GREEN");