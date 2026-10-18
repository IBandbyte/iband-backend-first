import assert from "node:assert/strict";
import mongoose from "mongoose";
import Stripe from "stripe";
import {recoverMovieMentorCompletedChargebacks} from "../ai/MovieMentorCompletedChargebackRecovery.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated AUD-OPEN-01 MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"physical MongoDB replica set required");
 const stripe=new Stripe("sk_test_aud_open_01_no_network");
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_aud_open_01",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(issuance.ready,true);assert.equal(reversal.ready,true);assert.equal(value.ready,true);
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(checkout.ready,true);
 await reversal.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
 const records=Array.from({length:5001},(_,i)=>({
  domain:"iband.movie-mentor.inference-spend",schema:1,
  reversalId:"aud-backlog-"+String(i).padStart(6,"0"),
  evidenceId:"evt-aud-backlog-"+i,evidenceSource:"stripe",evidenceKind:"charge.refunded",
  providerPaymentReference:"pi-aud-backlog-"+i,commercialReference:"intent-aud-backlog-"+i,
  principalId:"principal-aud-backlog-"+i,reversalAmountMinor:100,currency:"GBP",
  entitlementRevisionBefore:1,entitlementRevisionAfter:2,status:"suspended",reversedAt:new Date()
 }));
 await db.collection("movie_mentor_commercial_reversal").insertMany(records,{ordered:true});
 assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({evidenceSource:"stripe"}),5001);
 const first=await reversal.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:50});
 assert.equal(first.receipts.length,50);
 assert.ok(first.nextCursor);
 const result=await recoverMovieMentorCompletedChargebacks({
  reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,
  checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority
 });
 assert.equal(result.complete,true,"AUD-OPEN-01 PHYSICAL RED: 5001 safe historic receipts must not block startup recovery");
 assert.equal(result.scanned,5001);
 assert.equal(result.skipped,5001);
 console.log("AUD-OPEN-01 5001-RECEIPT STARTUP RECOVERY GREEN");
}finally{await mongoose.disconnect();}
