import assert from "node:assert/strict";
import mongoose from "mongoose";
import {recoverMovieMentorCompletedChargebacks} from "../ai/MovieMentorCompletedChargebackRecovery.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import Stripe from "stripe";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const disposition=createMovieMentorProductionCommercialValueDispositionComposition();
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe:new Stripe("sk_test_aud_open_01_no_network"),webhookSecret:"whsec_aud_open_01_financial",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 for(const c of [purchase,issuance,reversal,disposition,checkout])assert.equal(c.ready,true,"real production composition required");
 const authorities={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:disposition.authority};
 const ledger=mongoose.connection.db.collection("movie_mentor_commercial_value_disposition");
 const before=await ledger.countDocuments({});
 for(const key of Object.keys(authorities)){
  const forged=Object.freeze({...authorities[key]});
  await assert.rejects(
   recoverMovieMentorCompletedChargebacks({...authorities,[key]:forged,maxPages:1}),
   error=>error?.code==="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED",
   "forged "+key+" must fail closed before any scan or settlement"
  );
 }
 assert.equal(await ledger.countDocuments({}),before,"forged recovery authorities must not change the financial ledger");
 console.log("AUD OWNER-PROOF INGRESS GREEN: all four forged authority wrappers fenced without financial write; no leaseProof assumption");
}finally{await mongoose.disconnect();}
