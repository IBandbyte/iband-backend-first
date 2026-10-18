import {recoverMovieMentorCompletedChargebacks} from "../ai/MovieMentorCompletedChargebackRecovery.js";
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

import {spawn} from "node:child_process";
import {once} from "node:events";

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
async function childA(){
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
  dispositionModel.findOneAndUpdate=function(query,update,...options){
   if(query?.provider==="stripe"&&query?.providerPaymentReference===payment&&update?.$push?.chargebackEvents){
    process.stdout.write("AUD_PROCESS_A_AT_LEDGER_CAS\\n",()=>process.kill(process.pid,"SIGSTOP"));
    return new Promise(()=>{});
   }
   return originalUpdate.call(this,query,update,...options);
  };
  await ingress.authority.ingest({provider:"stripe",delivery});
  throw Error("UNEXPECTED_SETTLEMENT_BEFORE_PROCESS_KILL");
 }finally{await mongoose.disconnect();}
}
async function childB(){
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
 try{
  const db=mongoose.connection.db;
  assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
  const {purchase,issuance,reversal,value,checkout}=freshAuthorities();
  assert.equal(issuance.ready,true);
  const first=await recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority});
  assert.equal(first.complete,true);
  assert.equal(first.settled,1,"fresh process must settle one committed chargeback");
  const second=await recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority});
  assert.equal(second.complete,true);
  assert.equal(second.settled,0,"replay cannot resettle");
  const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment});
  assert.equal(row.remainingAmountMinor,900);
  assert.equal(row.chargebackAmountMinor,300);
  assert.equal((row.chargebackEvents||[]).filter(e=>e.reference===eventId).length,1);
  assert.equal(await db.collection("movie_mentor_commercial_reversal").countDocuments({evidenceSource:"stripe",evidenceId:eventId}),1);
  console.log("AUD PROCESS B GREEN: fresh authority chain, no redelivery, exact-once 300/900");
 }finally{await mongoose.disconnect();}
}
async function parent(){
 const child=spawn(process.execPath,[process.argv[1],"A"],{env:process.env,stdio:["ignore","pipe","pipe"]});
 let output="",errors="",killed=false;
 child.stdout.setEncoding("utf8");
 child.stderr.setEncoding("utf8");
 child.stderr.on("data",s=>{errors+=s;});
 const killAt=setTimeout(()=>{if(!killed)child.kill("SIGKILL");},45000);
 child.stdout.on("data",s=>{output+=s;if(!killed&&output.includes("AUD_PROCESS_A_AT_LEDGER_CAS")){killed=true;child.kill("SIGKILL");}});
 const [code,signal]=await once(child,"exit");
 clearTimeout(killAt);
 assert.equal(signal,"SIGKILL","Process A must be killed by operating system; "+errors+" "+output);
 assert.equal(killed,true,"Process A never reached post-commit/pre-settlement boundary: "+errors+" "+output);
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
 try{
  const db=mongoose.connection.db;
  const receipt=await db.collection("movie_mentor_commercial_reversal").findOne({evidenceSource:"stripe",evidenceId:eventId});
  assert.equal(receipt?.reversalAmountMinor,300,"receipt must survive actual SIGKILL");
  assert.equal((await db.collection("movie_mentor_inference_entitlement").findOne({principalId:"aud-signed-ingress-principal"}))?.status,"suspended");
  const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment});
  assert.equal(row?.remainingAmountMinor,1200,"Process A must die before settlement");
  assert.equal(row?.chargebackAmountMinor,0);
 }finally{await mongoose.disconnect();}
 const b=spawn(process.execPath,[process.argv[1],"B"],{env:process.env,stdio:["ignore","pipe","pipe"]});
 let bout="",berr="";
 b.stdout.on("data",s=>{bout+=s;});b.stderr.on("data",s=>{berr+=s;});
 const timeout=setTimeout(()=>b.kill("SIGKILL"),45000);
 const [exitCode,exitSignal]=await once(b,"exit");clearTimeout(timeout);
 assert.equal(exitSignal,null,"Process B terminated by signal: "+berr);
 assert.equal(exitCode,0,"Process B recovery failed: "+berr+" "+bout);
 assert.match(bout,/AUD PROCESS B GREEN/);
 console.log("AUD REAL PROCESS-DEATH GREEN: SIGKILL A, fresh independent B, no redelivery");
}
if(mode==="A")await childA();else if(mode==="B")await childB();else await parent();
