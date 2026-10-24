import assert from "node:assert/strict";
import {AsyncLocalStorage} from "node:async_hooks";
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
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let release,signal,model,originalCreate,ledgerModel,originalLedgerUpdate,releaseLedger,signalLedger;
let durableChargebackCasWinners=0;
const settlementWorkerContext=new AsyncLocalStorage();
const durableWinnersByWorker=new Map();
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
  if(query?.provider==="stripe"&&query?.providerPaymentReference==="pi-ledger-A"&&update?.$push?.chargebackEvents){
   const q=originalLedgerUpdate.call(this,query,update,...options);
   const originalLean=q.lean.bind(q);
   q.lean=(...args)=>{
    const leanQuery=originalLean(...args);
    const originalExec=leanQuery.exec.bind(leanQuery);
    leanQuery.exec=async(...execArgs)=>{
     const updated=await originalExec(...execArgs);
     if(updated){
      durableChargebackCasWinners++;
      const worker=settlementWorkerContext.getStore()||"unattributed";
      durableWinnersByWorker.set(worker,(durableWinnersByWorker.get(worker)||0)+1);
     }
     return updated;
    };
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
 // Isolated candidate: explicit bounded full replay by two concurrent recovery workers.
 // This is NOT an autonomous scheduler, restart proof, or a production repair.
 const recoveryArgs={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1};
 const [second,third]=await Promise.all([
  settlementWorkerContext.run("worker-2",()=>recoverMovieMentorCompletedChargebacks(recoveryArgs)),
  settlementWorkerContext.run("worker-3",()=>recoverMovieMentorCompletedChargebacks(recoveryArgs))
 ]);
 assert.equal(second.complete,true);assert.equal(third.complete,true);
 const settled=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 const events=Array.isArray(settled.chargebackEvents)?settled.chargebackEvents:[];
 console.log("CONCURRENT REPLAY LEDGER OBSERVATION",JSON.stringify({reportedSettled:[second.settled,third.settled],reportedAlreadySettled:[second.alreadySettled,third.alreadySettled],remainingAmountMinor:settled.remainingAmountMinor,chargebackAmountMinor:settled.chargebackAmountMinor,chargebackEventCount:events.length,chargebackEvents:events.map(e=>({evidenceId:e.evidenceId,terminalReference:e.terminalReference,amountMinor:e.amountMinor,chargebackAmountMinor:e.chargebackAmountMinor}))}));
 assert.equal(settled.remainingAmountMinor,900,"durable ledger must deduct late chargeback exactly once");
 assert.equal(settled.chargebackAmountMinor,300,"durable chargeback amount must remain exactly once");
 assert.equal(events.length,1,"durable ledger must record exactly one chargeback event");
 console.log("DURABLE CAS WINNER DIAGNOSTIC",JSON.stringify({successfulConditionalUpdates:durableChargebackCasWinners,reportedSettled:[second.settled,third.settled]}));
 assert.equal(durableChargebackCasWinners,1,"exactly one chargeback CAS may win for late receipt A");
 console.log("ISOLATED WORKER OWNERSHIP CANDIDATE",JSON.stringify({durableWinnersByWorker:Object.fromEntries(durableWinnersByWorker),workerReports:[second.settled,third.settled]}));
 assert.equal((durableWinnersByWorker.get("worker-2")||0)+(durableWinnersByWorker.get("worker-3")||0),1,"one of two isolated workers must own the successful database transition");
 assert.equal(durableWinnersByWorker.has("unattributed"),false,"winner must be attributed to a real recovery worker");
 // Verifier-only candidate contract: count durable transition owners, not observers.
 // This deliberately does NOT modify the production recovery result or settle API.
 const candidateWorkerReports=["worker-2","worker-3"].map(worker=>({worker,settled:durableWinnersByWorker.get(worker)||0,observedReportedSettled:worker==="worker-2"?second.settled:third.settled}));
 console.log("REPORTING OWNERSHIP REPAIR CANDIDATE",JSON.stringify({candidateWorkerReports,productionReportedSettled:[second.settled,third.settled]}));
 assert.equal(candidateWorkerReports.reduce((sum,worker)=>sum+worker.settled,0),1,"isolated ownership-based settlement counter must report exactly one transition");
 assert.equal(candidateWorkerReports.filter(worker=>worker.settled===1).length,1,"only the physical transition owner may report settled");
 assert.equal(candidateWorkerReports.filter(worker=>worker.settled===0&&worker.observedReportedSettled===1).length,0,"non-owner must not report a settlement after ownership repair");
 assert.equal(second.settled+third.settled,1,"concurrent replay counters must report one successful settlement");
 console.log("ISOLATED BOUNDED-REPLAY CANDIDATE: concurrent replays settled late chargeback exactly once; no autonomous trigger or restart proven");console.log("FINANCIAL CURSOR COURT: A committed DURING active recovery after cursor advanced; first scan falsely completed while A ledger unsettled; fresh scan settled exactly once");
}finally{
 release?.();releaseLedger?.();
 if(model&&originalCreate)model.create=originalCreate;
 if(ledgerModel&&originalLedgerUpdate)ledgerModel.findOneAndUpdate=originalLedgerUpdate;
 await mongoose.disconnect();
}
