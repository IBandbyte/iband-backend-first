import assert from "node:assert/strict";
import mongoose from "mongoose";
import Stripe from "stripe";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 let db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"real replica set required");
 const stripe=new Stripe("sk_test_aud_open_01_no_network");
 const secret="whsec_aud_open_01_signed_ingress";
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:secret,successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(issuance.ready,true);assert.equal(reversal.ready,true);assert.equal(value.ready,true);
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(checkout.ready,true);
 const ingress=createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,issuanceAuthority:issuance.authority,reversalAuthority:reversal.authority,dispositionAuthority:value.authority,providers:{stripe:adapter}});
 assert.equal(ingress.ready,true);
 const principalId="aud-signed-ingress-principal",commercialIntentId="aud-signed-ingress-intent",providerPaymentReference="pi_aud_signed_ingress",evidenceId="evt_aud_signed_ingress";
 // Fixture rows are inserted directly solely to establish already-paid durable coordinates.
 // All ingress and reversal/settlement actions under test use genuine production authorities.
 await purchase.authority.resolvePurchaseIntent({commercialIntentId:"index-ready-probe"});
 await checkout.authority.resolveCheckoutBinding({commercialIntentId:"index-ready-probe"});
 await db.collection("movie_mentor_commercial_purchase_intent").insertOne({domain:"iband.movie-mentor.commercial-purchase-intent",schema:2,commercialIntentId,principalId,purchaseAttemptDigest:"aud-signed-ingress-attempt",packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture",policyDigest:"aud-fixture",status:"created",createdAtAuthority:new Date()});
 await db.collection("movie_mentor_commercial_checkout_binding").insertOne({domain:"iband.movie-mentor.commercial-checkout-binding",schema:1,commercialIntentId,provider:"stripe",idempotencyKey:"aud-signed-ingress-checkout",status:"completed",checkoutReference:"cs_aud_signed_ingress",checkoutUrl:"https://example.invalid/checkout",providerPaymentReference,createdAtAuthority:new Date(),completedAtAuthority:new Date()});
 await db.collection("movie_mentor_inference_entitlement").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 await value.authority.preserveVerifiedPaidValue({provider:"stripe",providerPaymentReference,commercialIntentId,principalId,amountMinor:1200,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false});
 const event={id:evidenceId,object:"event",type:"charge.dispute.funds_withdrawn",livemode:false,data:{object:{id:"dp_aud_signed_ingress",object:"dispute",payment_intent:providerPaymentReference,amount:300,currency:"gbp"}}};
 const rawBody=JSON.stringify(event),signature=stripe.webhooks.generateTestHeaderString({payload:rawBody,secret});
 const delivery={rawBody:Buffer.from(rawBody),signature};
 await assert.rejects(()=>ingress.authority.ingest({provider:"stripe",delivery:{...delivery,signature:"t=1,v1=invalid"}}),e=>e?.code==="MOVIE_MENTOR_STRIPE_SIGNATURE_INVALID");
 assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({evidenceSource:"stripe",evidenceId}),0);
 // Test-only failure at the actual value-ledger CAS boundary, after reversal transaction commits.
 // Preserve all owner-bound production authorities; no production code or provider network is altered.
 const dispositionModel=mongoose.model("MovieMentorCommercialValueDisposition");
 const originalUpdate=dispositionModel.findOneAndUpdate;
 let injected=0;
 dispositionModel.findOneAndUpdate=function(query,update,...options){
  if(injected===0&&query?.provider==="stripe"&&query?.providerPaymentReference===providerPaymentReference&&update?.$push?.chargebackEvents){
   injected++;
   throw Object.assign(new Error("AUD_CASE_D_INJECTED_POST_REVERSAL_PRE_SETTLEMENT"),{code:"AUD_CASE_D_INJECTED_POST_REVERSAL_PRE_SETTLEMENT"});
  }
  return originalUpdate.call(this,query,update,...options);
 };
 try{
  await assert.rejects(()=>ingress.authority.ingest({provider:"stripe",delivery}),e=>e?.code==="AUD_CASE_D_INJECTED_POST_REVERSAL_PRE_SETTLEMENT");
 }finally{dispositionModel.findOneAndUpdate=originalUpdate;}
 assert.equal(injected,1,"fault must strike the actual value-ledger CAS exactly once");
 assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({evidenceSource:"stripe",evidenceId}),1,"reversal receipt committed before failure");
 assert.equal((await db.collection("movie_mentor_inference_entitlement").findOne({principalId})).status,"suspended");
 const unsettled=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference});
 assert.equal(unsettled.chargebackAmountMinor,0,"value ledger remains unsettled after injected interruption");
 assert.equal(unsettled.remainingAmountMinor,1200);
 console.log("CASE D SIGNED INGRESS CRASH CHECKPOINT: signed reversal committed, value-ledger CAS interrupted, preserved credit unsettled");
 // Original process and database connection remain alive; no redelivery or explicit recovery.
 const recoveryStart=Date.now();
 const deadline=recoveryStart+60_000;
 let settled=null;
 while(Date.now()<deadline){
  const current=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference});
  if(current?.chargebackAmountMinor===300&&current?.remainingAmountMinor===900){
   settled=current;
   break;
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.ok(settled,"AUD-OPEN-01 PHYSICAL RED: committed reversal did not autonomously settle preserved value within 60 seconds with original process alive, with zero Stripe redeliveries");
 assert.equal((settled.chargebackEvents||[]).filter(e=>e.reference===evidenceId).length,1,"one exact chargeback event");
 assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({evidenceSource:"stripe",evidenceId}),1,"one durable reversal receipt");
 console.log("CASE D NO-REDELIVERY GREEN: same-process settlement within 60 seconds, exact once");
}finally{await mongoose.disconnect();}
