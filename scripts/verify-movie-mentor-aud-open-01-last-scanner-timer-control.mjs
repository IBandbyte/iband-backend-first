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

const payment="pi_aud_signed_ingress",eventId="evt_aud_signed_ingress";
function unusedFreshAuthorities(){
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
async function verifySignedIngressInvertedCommitRetry(){
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

   const principalB="aud-signed-ingress-principal-B",intentB="aud-signed-ingress-intent-B",paymentB="pi_aud_signed_ingress_B",eventB="evt_aud_signed_ingress_B";
   await db.collection("movie_mentor_commercial_purchase_intent").insertOne({domain:"iband.movie-mentor.commercial-purchase-intent",schema:2,commercialIntentId:intentB,principalId:principalB,purchaseAttemptDigest:"aud-signed-ingress-attempt-B",packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture",policyDigest:"aud-fixture",status:"created",createdAtAuthority:new Date()});
   await db.collection("movie_mentor_commercial_checkout_binding").insertOne({domain:"iband.movie-mentor.commercial-checkout-binding",schema:1,commercialIntentId:intentB,provider:"stripe",idempotencyKey:"aud-signed-ingress-checkout-B",status:"completed",checkoutReference:"cs_aud_signed_ingress_B",checkoutUrl:"https://example.invalid/checkout",providerPaymentReference:paymentB,createdAtAuthority:new Date(),completedAtAuthority:new Date()});
   await db.collection("movie_mentor_inference_entitlement").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId:principalB,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
   await value.authority.preserveVerifiedPaidValue({provider:"stripe",providerPaymentReference:paymentB,commercialIntentId:intentB,principalId:principalB,amountMinor:1200,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false});
   const eventTwo={id:eventB,object:"event",type:"charge.dispute.funds_withdrawn",livemode:false,data:{object:{id:"dp_aud_signed_ingress_B",object:"dispute",payment_intent:paymentB,amount:300,currency:"gbp"}}};
   const rawTwo=JSON.stringify(eventTwo),sigTwo=stripe.webhooks.generateTestHeaderString({payload:rawTwo,secret});

  const dispositionModel=mongoose.model("MovieMentorCommercialValueDisposition");
  const originalUpdate=dispositionModel.findOneAndUpdate;
  let injected=0;
  try{
   let secondInjection=0;
   dispositionModel.findOneAndUpdate=function(query,update,...options){
    const q=originalUpdate.call(this,query,update,...options);
    const target=query?.provider==="stripe"&&update?.$push?.chargebackEvents;
    const a=target&&query?.providerPaymentReference===payment&&injected++===0;
    const b=target&&query?.providerPaymentReference===paymentB&&secondInjection++===0;
    if(a||b){
     const lean=q.lean.bind(q);
     q.lean=(...args)=>{const result=lean(...args);result.exec=async()=>{throw Error(a?"AUD_ONE_SHOT_LEDGER_FAILURE":"AUD_SECOND_LEDGER_FAILURE");};return result;};
    }
    return q;
   };
   await reversal.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
   const reversalModel=mongoose.model("MovieMentorCommercialReversal");
   const originalCreate=reversalModel.create;
   let releaseA,notifyA;
   const heldA=new Promise(resolve=>{releaseA=resolve;});
   const enteredA=new Promise(resolve=>{notifyA=resolve;});
   let firstId;
   reversalModel.create=async function(docs,opts){
    if(docs?.[0]?.evidenceId===eventId){
     firstId=docs[0].reversalId;
     notifyA();
     await heldA;
    }
    return originalCreate.call(this,docs,opts);
   };
   try{
   const firstIngress=ingress.authority.ingest({provider:"stripe",delivery});
   await enteredA;
   const secondIngress=ingress.authority.ingest({provider:"stripe",delivery:{rawBody:Buffer.from(rawTwo),signature:sigTwo}});
   const secondResult=await Promise.allSettled([secondIngress]);
   assert.equal(secondResult[0].status,"rejected","later-ID B must fail ledger once and schedule retry");
   assert.match(String(secondResult[0].reason),/AUD_SECOND_LEDGER_FAILURE/);
   const bReceipt=await db.collection("movie_mentor_commercial_reversal").findOne({evidenceId:eventB});
   assert.ok(bReceipt&&firstId<bReceipt.reversalId,"A earlier generated ID must remain uncommitted until B committed");
   releaseA();
   const firstResult=await Promise.allSettled([firstIngress]);
   assert.equal(firstResult[0].status,"rejected","A must fail ledger once and schedule own real retry");
   assert.match(String(firstResult[0].reason),/AUD_ONE_SHOT_LEDGER_FAILURE/);
   assert.equal(injected,1);
   assert.equal(secondInjection,1);
   const aReceipt=await db.collection("movie_mentor_commercial_reversal").findOne({evidenceId:eventId});
   assert.ok(aReceipt,"A must durably commit after B");
   console.log("AUD INVERTED SIGNED INGRESS: earlier-generated A committed after B; both ledger failures scheduled real timers");
   }finally{releaseA?.();reversalModel.create=originalCreate;}
   const deadline=Date.now()+10000;
   let row,secondRow;
   while(Date.now()<deadline){
    [row,secondRow]=await Promise.all([payment,paymentB].map(providerPaymentReference=>db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference})));
    if(row?.chargebackAmountMinor===300&&secondRow?.chargebackAmountMinor===300)break;
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   assert.equal(row?.chargebackAmountMinor,300,"first signed ingress must settle via autonomous retry");
   assert.equal(secondRow?.chargebackAmountMinor,300,"second signed ingress must settle via autonomous retry");
   for(const [record,id] of [[row,eventId],[secondRow,eventB]]){
    assert.equal(record.remainingAmountMinor,900);
    assert.equal((record.chargebackEvents||[]).filter(e=>e.reference===id).length,1);
   }
   console.log("AUD LAST-SCANNER TIMER CONTROL GREEN: A generated earlier, committed after B, two genuine one-shot ledger failures, real timers settled both exactly once");
  }finally{dispositionModel.findOneAndUpdate=originalUpdate;}
 }finally{await mongoose.disconnect();}
}
await verifySignedIngressInvertedCommitRetry();
