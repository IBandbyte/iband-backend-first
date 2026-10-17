import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const db=mongoose.connection.db;
 const hello=await db.admin().command({hello:1});
 assert.ok(hello.setName,"real MongoDB replica set required");
 const stripe={
  checkout:{sessions:{create:async()=>{throw Error("NO_EXTERNAL_STRIPE_CALL");},retrieve:async()=>{throw Error("NO_EXTERNAL_STRIPE_CALL");},expire:async()=>{throw Error("NO_EXTERNAL_STRIPE_CALL");}}},
  webhooks:{constructEvent:()=>{throw Error("SIGNATURE_DELIVERY_NOT_IN_SCOPE");}}
 };
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_local_startup_only",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("POLICY_NOT_USED_IN_STARTUP");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(issuance.ready,true,issuance.reason);
 assert.equal(reversal.ready,true,reversal.reason);
 assert.equal(value.ready,true,value.reason);
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(checkout.ready,true);
 const ingress=createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,issuanceAuthority:issuance.authority,reversalAuthority:reversal.authority,dispositionAuthority:value.authority,providers:{stripe:adapter}});
 assert.equal(ingress.ready,true,ingress.reason);
 assert.equal(typeof ingress.authority.ingest,"function");
 // Trigger actual production store readiness paths, not merely configured status.
 assert.equal(await purchase.authority.resolvePurchaseIntent({commercialIntentId:"missing-startup-probe"}),null);
 assert.equal(await checkout.authority.resolveCheckoutBinding({commercialIntentId:"missing-startup-probe"}),null);
 const purchaseIndexes=await db.collection("movie_mentor_commercial_purchase_intent").indexes();
 const checkoutIndexes=await db.collection("movie_mentor_commercial_checkout_binding").indexes();
 assert.ok(purchaseIndexes.some(x=>x.unique===true&&JSON.stringify(x.key)===JSON.stringify({commercialIntentId:1})));
 assert.ok(purchaseIndexes.some(x=>x.unique===true&&JSON.stringify(x.key)===JSON.stringify({domain:1,schema:1,principalId:1,purchaseAttemptDigest:1})));
 assert.ok(checkoutIndexes.some(x=>x.unique===true&&JSON.stringify(x.key)===JSON.stringify({commercialIntentId:1})));
 assert.ok(checkoutIndexes.some(x=>x.unique===true&&JSON.stringify(x.key)===JSON.stringify({provider:1,checkoutReference:1})&&x.partialFilterExpression?.checkoutReference?.$type==="string"));
 assert.ok(checkoutIndexes.some(x=>x.unique===true&&JSON.stringify(x.key)===JSON.stringify({provider:1,providerPaymentReference:1})&&x.partialFilterExpression?.providerPaymentReference?.$type==="string"));
 console.log("CASE D STARTUP GREEN: real owner-proven production ingress compositions and MongoDB purchase/checkout physical indexes");
 console.log("NOT PROVEN: signed Stripe delivery, reversal crash/replay, autonomous recovery, or live Stripe effects");
} finally {await mongoose.disconnect();}
