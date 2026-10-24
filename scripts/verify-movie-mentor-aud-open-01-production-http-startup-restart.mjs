import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {generateKeyPairSync} from "node:crypto";
import {mountMovieMentorProductionCommercialHttpIngress} from "../ai/MovieMentorProductionCommercialHttpIngress.js";
import {fileURLToPath} from "node:url";
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
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
if(!process.env.AUD_RESTART_CHILD){
 const child=spawn(process.execPath,[fileURLToPath(import.meta.url)],{env:{...process.env,AUD_RESTART_CHILD:"prepare"},stdio:["ignore","pipe","pipe"]});
 let output="",stderr="";
 child.stdout.on("data",chunk=>{output+=chunk.toString();});
 child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
 const ready=await Promise.race([
  new Promise((resolve,reject)=>{
   const check=()=>{if(output.includes("AUD_RESTART_MISSED_DURABLE_READY"))resolve(true);};
   child.stdout.on("data",check);
   child.on("exit",(code,signal)=>reject(Error("prepare child exited before durable miss: "+code+" "+signal+" "+stderr.slice(-1000))));
   check();
  }),
  new Promise((_,reject)=>setTimeout(()=>reject(Error("prepare child timeout: "+stderr.slice(-1000))),20000))
 ]);
 assert.equal(ready,true);
 child.kill("SIGKILL");
 await new Promise(resolve=>child.once("exit",resolve));
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
 try{
  const db=mongoose.connection.db;
  const before=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
  assert.equal(before?.chargebackAmountMinor,0,"process death must precede A financial settlement");
  // The restarted process invokes ONLY the real production HTTP ingress mount.
  // No verifier-side recovery invocation and no webhook delivery.
  const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048,publicKeyEncoding:{type:"spki",format:"pem"},privateKeyEncoding:{type:"pkcs8",format:"pem"}});
  const env={
   MOVIE_MENTOR_CLERK_JWT_KEY:publicKey,
   MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify(["https://app.example.com"]),
   MOVIE_MENTOR_CLERK_ISSUER:"https://issuer.example.com",
   MOVIE_MENTOR_AUDIENCE:"movie-mentor",
   MOVIE_MENTOR_COMMERCIAL_POLICY_JSON:JSON.stringify([{packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture"}]),
   MOVIE_MENTOR_STRIPE_WEBHOOK_SECRET:"whsec_aud_open_01_financial",
   MOVIE_MENTOR_STRIPE_SUCCESS_URL:"https://example.invalid/success",
   MOVIE_MENTOR_STRIPE_CANCEL_URL:"https://example.invalid/cancel"
  };
  const stripe=new Stripe("sk_test_aud_open_01_no_network");
  let routeRegistrations=0;
  const app={post(){routeRegistrations++;}};
  const mount=await mountMovieMentorProductionCommercialHttpIngress({app,env,stripe});
  assert.equal(mount.mounted,true,"real production ingress startup must mount: "+mount.reason);
  assert.equal(routeRegistrations,1,"real provider ingress route must be registered after recovery");
  const after=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
  assert.equal(after?.chargebackAmountMinor,300);
  assert.equal(after?.remainingAmountMinor,900);
  assert.equal((after?.chargebackEvents||[]).length,1);
  const durableEvents=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
  assert.equal((durableEvents?.chargebackEvents||[]).length,1);
  console.log("AUD STARTUP MOUNT GREEN: SIGKILL after cursor miss; genuine production HTTP ingress startup settled durable receipt exactly once without webhook or direct verifier recovery");
 }finally{await mongoose.disconnect();}
 process.exit(0);
}
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let release,signal,model,originalCreate,ledgerModel,originalLedgerUpdate,releaseLedger,signalLedger;
const ledgerHeld=new Promise(r=>releaseLedger=r),ledgerEntered=new Promise(r=>signalLedger=r);
const held=new Promise(r=>release=r),entered=new Promise(r=>signal=r);
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName);
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 const stripe=new Stripe("sk_test_aud_open_01_no_network");
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_aud_open_01_financial",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 assert.equal(reversal.ready,true);assert.equal(value.ready,true);assert.equal(checkout.ready,true);
 await purchase.authority.resolvePurchaseIntent({commercialIntentId:"index-ready-probe"});
 await checkout.authority.resolveCheckoutBinding({commercialIntentId:"index-ready-probe"});
 const principals=["A","B","C"];
 for(const p of principals){
  const principalId="ledger-order-"+p,commercialIntentId="ledger-intent-"+p,providerPaymentReference="pi-ledger-"+p;
  await db.collection("movie_mentor_commercial_purchase_intent").insertOne({domain:"iband.movie-mentor.commercial-purchase-intent",schema:2,commercialIntentId,principalId,purchaseAttemptDigest:"ledger-attempt-"+p,packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture",policyDigest:"aud-fixture",status:"created",createdAtAuthority:new Date()});
  await db.collection("movie_mentor_commercial_checkout_binding").insertOne({domain:"iband.movie-mentor.commercial-checkout-binding",schema:1,commercialIntentId,provider:"stripe",idempotencyKey:"ledger-checkout-"+p,status:"completed",checkoutReference:"cs-ledger-"+p,checkoutUrl:"https://example.invalid/checkout",providerPaymentReference,createdAtAuthority:new Date(),completedAtAuthority:new Date()});
  await db.collection("movie_mentor_inference_entitlement").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
  await value.authority.preserveVerifiedPaidValue({provider:"stripe",providerPaymentReference,commercialIntentId,principalId,amountMinor:1200,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false});
 }
 await reversal.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
 model=mongoose.model("MovieMentorCommercialReversal");
 originalCreate=model.create;
 model.create=async function(docs,options){
  if(docs?.[0]?.evidenceId==="evt-ledger-A"){signal(docs[0].reversalId);await held;}
  return originalCreate.call(this,docs,options);
 };
 const suspend=p=>reversal.authority.suspendVerifiedReversal({reversal:{verified:true,evidenceId:"evt-ledger-"+p,evidenceSource:"stripe",evidenceKind:"charge.dispute.funds_withdrawn",providerPaymentReference:"pi-ledger-"+p,reversalAmountMinor:300,currency:"GBP",verifiedAt:new Date().toISOString(),commercialReference:"ledger-intent-"+p,principalId:"ledger-order-"+p}});
 const a=suspend("A");
 const earlyId=await entered;
 const b=await suspend("B"),c=await suspend("C");
 assert.ok(earlyId<b.reversalId&&b.reversalId<c.reversalId);
 ledgerModel=mongoose.model("MovieMentorCommercialValueDisposition");
 originalLedgerUpdate=ledgerModel.findOneAndUpdate;
 ledgerModel.findOneAndUpdate=function(query,update,...options){
  if(query?.provider==="stripe"&&query?.providerPaymentReference==="pi-ledger-B"&&update?.$push?.chargebackEvents){
   signalLedger();
   const q=originalLedgerUpdate.call(this,query,update,...options);
   const originalLean=q.lean.bind(q);
   q.lean=(...args)=>{
    const leanQuery=originalLean(...args);
    const originalExec=leanQuery.exec.bind(leanQuery);
    leanQuery.exec=(...execArgs)=>ledgerHeld.then(()=>originalExec(...execArgs));
    return leanQuery;
   };
   return q;
  }
  return originalLedgerUpdate.call(this,query,update,...options);
 };
 const firstPromise=recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1});
 await ledgerEntered;
 release();
 const aResult=await a;
 assert.equal(aResult.reversalId,earlyId,"earlier-generated reversal must commit while first recovery remains active");
 releaseLedger();
 const first=await firstPromise;
 assert.equal(first.complete,true);
 assert.equal(first.settled,2,"first scan misses A despite A committing before the scan finished");
 const pending=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(pending.remainingAmountMinor,1200,"late committed reversal remains financially unsettled after earlier scan");
 assert.equal(pending.chargebackAmountMinor,0);
 // First process must die with A durably missed and financially unsettled.
 console.log("AUD_RESTART_MISSED_DURABLE_READY");
 await new Promise(()=>{}); // parent sends SIGKILL after marker; no graceful shutdown

}finally{
 release?.();releaseLedger?.();
 if(model&&originalCreate)model.create=originalCreate;
 if(ledgerModel&&originalLedgerUpdate)ledgerModel.findOneAndUpdate=originalLedgerUpdate;
 await mongoose.disconnect();
 // Production recurring timers are unref'd but can leave asynchronous driver work.
 // This isolated, one-shot CLI verifier explicitly terminates after assertions.
 process.exit(0);
}
