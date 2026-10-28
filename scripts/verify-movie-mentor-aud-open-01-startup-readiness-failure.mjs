import {recoverMovieMentorCompletedChargebacks} from "../ai/MovieMentorCompletedChargebackRecovery.js";
import assert from "node:assert/strict";
import express from "express";
import {mountMovieMentorProductionCommercialHttpIngress} from "../ai/MovieMentorProductionCommercialHttpIngress.js";
import {generateKeyPairSync} from "node:crypto";
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
const mode=process.argv[2]||"parent";
const payment="pi_aud_signed_ingress",eventId="evt_aud_signed_ingress";
function freshAuthorities(){
 const stripe=new Stripe("sk_test_aud_open_01_no_network");
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_aud_open_01_signed_ingress",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(issuance.ready,true);assert.equal(reversal.ready,true);assert.equal(value.ready,true);
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(checkout.ready,true);
 return {stripe,adapter,purchase,issuance,reversal,value,checkout};
}
async function verifyStartupFailureReadiness(){
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
 try{
  const db=mongoose.connection.db;
  assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
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

  const dispositionModel=mongoose.model("MovieMentorCommercialValueDisposition");
  const originalUpdate=dispositionModel.findOneAndUpdate;
  let injected=0;
  try{
   dispositionModel.findOneAndUpdate=function(query,update,...options){
    const q=originalUpdate.call(this,query,update,...options);
    if(query?.provider==="stripe"&&query?.providerPaymentReference===payment&&update?.$push?.chargebackEvents&&injected++===0){
     const originalLean=q.lean.bind(q);
     q.lean=(...args)=>{
      const result=originalLean(...args);
      result.exec=async()=>{throw Error("AUD_ONE_SHOT_LEDGER_FAILURE");};
      return result;
     };
    }
    return q;
   };
   await assert.rejects(()=>ingress.authority.ingest({provider:"stripe",delivery}),/AUD_ONE_SHOT_LEDGER_FAILURE/);
   assert.equal(injected,1,"signed ingress must reach genuine ledger settlement");
   const receipt=await db.collection("movie_mentor_commercial_reversal").findOne({evidenceSource:"stripe",evidenceId});
   assert.ok(receipt,"signed ingress must durably commit reversal before settlement failure");
   // Hold the same genuine settlement writer failure across a new production mount.
   // The existing owner-proven receipt was created through signed Stripe ingress.
   const originalLeanFailure=dispositionModel.findOneAndUpdate;
   dispositionModel.findOneAndUpdate=function(query,update,...options){
    const q=originalLeanFailure.call(this,query,update,...options);
    if(query?.provider==="stripe"&&query?.providerPaymentReference===payment&&update?.$push?.chargebackEvents){
     const lean=q.lean.bind(q);
     q.lean=(...args)=>{const result=lean(...args);result.exec=async()=>{throw Error("AUD_PERSISTENT_LEDGER_FAILURE");};return result;};
    }
    return q;
   };
   const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}});
   const env={
    MOVIE_MENTOR_CLERK_JWT_KEY:publicKey,
    MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify(["https://app.example.com"]),
    MOVIE_MENTOR_CLERK_ISSUER:"https://issuer.example.com",
    MOVIE_MENTOR_AUDIENCE:"movie-mentor",
    MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:JSON.stringify([{packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture"}]),
    MOVIE_MENTOR_STRIPE_WEBHOOK_SECRET:secret,
    MOVIE_MENTOR_STRIPE_SUCCESS_URL:"https://example.invalid/success",
    MOVIE_MENTOR_STRIPE_CANCEL_URL:"https://example.invalid/cancel"
   };
   const app=express();
   const mount=await mountMovieMentorProductionCommercialHttpIngress({app,env,stripe});
   assert.equal(mount.mounted,false,"genuine startup recovery must close commercial mount on persistent ledger failure");
   assert.equal(mount.reason,"completed-reversal-recovery-failed");
   // Root health registration below mirrors the unmodified server.js route.
   // This court does not claim to have booted the full root server.
   app.get("/health",(_req,res)=>res.json({ok:true}));
   const server=app.listen(0);
   try{
    await new Promise(resolve=>server.once("listening",resolve));
    const base="http://127.0.0.1:"+server.address().port;
    const health=await fetch(base+"/health");
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{ok:true});
    const webhook=await fetch(base+mount.stripeWebhookPath,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    assert.equal(webhook.status,404,"closed commercial mount must not register webhook");
    console.log("AUD STARTUP READINESS PHYSICAL: signed ingress committed reversal; persistent isolated ledger writer failure closed genuine production mount; independently mounted root-equivalent health returned 200; webhook absent");
   }finally{await new Promise(resolve=>server.close(resolve));}
  }finally{dispositionModel.findOneAndUpdate=originalUpdate;}
 }finally{await mongoose.disconnect();}
}
await verifyStartupFailureReadiness();
