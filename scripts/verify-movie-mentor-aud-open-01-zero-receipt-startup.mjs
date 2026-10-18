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
 assert.equal(issuance.ready,true);
 assert.equal(reversal.ready,true);
 assert.equal(value.ready,true);
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(checkout.ready,true);
 assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({}),0,"empty physical reversal history required");
 const empty=await reversal.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:50,cursor:null});
 assert.deepEqual(empty.receipts,[],"empty production-owned receipt page must be valid");
 assert.equal(empty.nextCursor,null,"empty receipt page must terminate scan");
 const result=await recoverMovieMentorCompletedChargebacks({
  reversalAuthority:reversal.authority,
  purchaseIntentAuthority:purchase.authority,
  checkoutBindingAuthority:checkout.authority,
  dispositionAuthority:value.authority
 });
 assert.deepEqual(result,{complete:true,scanned:0,settled:0,alreadySettled:0,skipped:0},
  "AUD-OPEN-01 PHYSICAL RED: zero completed receipts must not block clean commercial startup");
 assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({}),0);
 console.log("AUD-OPEN-01 ZERO-RECEIPT STARTUP GREEN: empty physical history terminates cleanly without mutation");
} finally {await mongoose.disconnect();}
