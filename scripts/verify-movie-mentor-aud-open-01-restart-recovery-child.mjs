import assert from "node:assert/strict";
import mongoose from "mongoose";
import Stripe from "stripe";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {recoverMovieMentorCompletedChargebacks} from "../ai/MovieMentorCompletedChargebackRecovery.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\\/\\/(?:127\\.0\\.0\\.1|localhost):27017\\/iband_aud_open_01(?:\\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 assert.ok((await mongoose.connection.db.admin().command({hello:1})).setName,"physical replica set required");
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 const stripe=new Stripe("sk_test_aud_open_01_no_network");
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_aud_open_01_financial",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(reversal.ready,true);assert.equal(value.ready,true);assert.equal(checkout.ready,true);
 const args={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1};
 const first=await recoverMovieMentorCompletedChargebacks(args);
 assert.equal(first.complete,true);
 assert.equal(first.settled,1,"fresh process must recover the previously missed chargeback");
 const row=await mongoose.connection.db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(row.remainingAmountMinor,900);
 assert.equal(row.chargebackAmountMinor,300);
 assert.equal((row.chargebackEvents||[]).length,1,"financial effect must occur once");
 const repeat=await recoverMovieMentorCompletedChargebacks(args);
 assert.equal(repeat.settled,0,"replayed receipt cannot settle again");
 assert.ok(repeat.alreadySettled>=1);
 console.log("AUD SEPARATE-PROCESS RESTART GREEN: fresh Node process recovered chargeback exactly once");
}finally{await mongoose.disconnect();}
