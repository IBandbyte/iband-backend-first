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
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,monitorCommands:true});
const observedFinancialWrites=[];
const observedOwnerWrites=[];
const commandListener=event=>{
 const c=event.command||{};
 const coll=c.findAndModify||c.update||c.insert;
 if(!coll||!c.lsid||c.txnNumber===undefined||c.autocommit!==false)return;
 const proof={collection:coll,lsid:JSON.stringify(c.lsid),txn:String(c.txnNumber),inTransaction:true};
 if(coll==="movie_mentor_commercial_value_disposition")observedFinancialWrites.push(proof);
 else if(/movie_mentor.*(chargeback|recovery).*(lease|owner)/i.test(coll))observedOwnerWrites.push(proof);
};
mongoose.connection.getClient().on("commandStarted",commandListener);
let release,signal,model,originalCreate,ledgerModel,originalLedgerUpdate,releaseLedger,signalLedger;
const ledgerHeld=new Promise(r=>releaseLedger=r),ledgerEntered=new Promise(r=>signalLedger=r);
const held=new Promise(r=>release=r),entered=new Promise(r=>signal=r);
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName);
 // Positive control: independently prove the command monitor observes both writes
 // with the same MongoDB transaction identity and an acknowledged generation CAS.
 const positiveLease=db.collection("movie_mentor_aud_recovery_lease_control");
 const positiveLedger=db.collection("movie_mentor_commercial_value_disposition");
 const controlId="aud-monitor-positive-control-"+process.pid;
 await positiveLease.insertOne({_id:controlId,domain:"completed-chargeback",owner:"control-A",generation:7,writerFenceRevision:0});
 await positiveLedger.insertOne({_id:controlId,domain:"aud-monitor-positive-control",revision:0});
 const controlSession=await mongoose.startSession();
 try{
  await controlSession.withTransaction(async()=>{
   const fence=await positiveLease.updateOne({_id:controlId,owner:"control-A",generation:7},{$inc:{writerFenceRevision:1}},{session:controlSession});
   assert.equal(fence.matchedCount,1,"POSITIVE MONITOR CONTROL: owner generation CAS must match");
   assert.equal(fence.modifiedCount,1,"POSITIVE MONITOR CONTROL: owner generation CAS must write");
   const ledger=await positiveLedger.updateOne({_id:controlId},{$inc:{revision:1}},{session:controlSession});
   assert.equal(ledger.matchedCount,1,"POSITIVE MONITOR CONTROL: ledger update must match");
   assert.equal(ledger.modifiedCount,1,"POSITIVE MONITOR CONTROL: ledger update must write");
  });
  const matching=observedOwnerWrites.some(o=>observedFinancialWrites.some(w=>o.lsid===w.lsid&&o.txn===w.txn));
  console.log("AUD MONITOR POSITIVE CONTROL: ownerWrites="+observedOwnerWrites.length+"; financialWrites="+observedFinancialWrites.length+"; sharedTransaction="+matching+"; ownerGeneration=7; acknowledged=true");
  assert.equal(matching,true,"POSITIVE MONITOR CONTROL RED: command monitor failed to detect known-good atomic lease/ledger writes");
 }finally{
  await controlSession.endSession();
  await positiveLease.deleteOne({_id:controlId});
  await positiveLedger.deleteOne({_id:controlId});
  observedOwnerWrites.length=0;
  observedFinancialWrites.length=0;
 }

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
 const firstPromise=recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1,maxPages:100});
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
 const recoveryArgs={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1,maxPages:100};
 // Verifier-only durable lease fixture. A production authority must bind its financial write to this ownership domain atomically.
 const leases=db.collection("aud_open_01_real_writer_transfer_fence");
 await leases.insertOne({domain:"completed-chargeback",owner:"worker-A",generation:1});
 const liveLedger=mongoose.model("MovieMentorCommercialValueDisposition");
 const liveUpdate=liveLedger.findOneAndUpdate;
 let releaseA,signalA;
 const heldA=new Promise(r=>releaseA=r),enteredA=new Promise(r=>signalA=r);
 let paused=false;
 let realWriterSessionSeen=false;
 liveLedger.findOneAndUpdate=function(query,update,...args){
  if(!paused&&query?.providerPaymentReference==="pi-ledger-A"&&update?.$push?.chargebackEvents){
   paused=true;
   const session=args[0]?.session;
   realWriterSessionSeen=Boolean(session&&typeof session.inTransaction==="function"&&session.inTransaction());
   const q=liveUpdate.call(this,query,update,...args);
   const originalLean=q.lean.bind(q);
   q.lean=(...params)=>{
    const l=originalLean(...params),originalExec=l.exec.bind(l);
    l.exec=(...execArgs)=>{signalA();return heldA.then(()=>originalExec(...execArgs));};
    return l;
   };
   return q;
  }
  return liveUpdate.call(this,query,update,...args);
 };
 try{
  const workerA=recoverMovieMentorCompletedChargebacks(recoveryArgs);
  await Promise.race([enteredA,new Promise((_,reject)=>setTimeout(()=>reject(Error("worker A did not reach real settlement boundary")),10000))]);
  const takeover=await leases.findOneAndUpdate({domain:"completed-chargeback",owner:"worker-A",generation:1},{$set:{owner:"worker-B"},$inc:{generation:1}},{returnDocument:"after"});
  assert.equal(takeover?.generation,2);
  // RED-FIRST: the superseded worker must not commit after durable takeover.
  // Resume A before starting B so idempotency cannot disguise stale-owner mutation.
  releaseA();
  let staleRejected=false;
  try{
   await workerA;
  }catch(error){
   if(error?.code!=="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED")throw error;
   staleRejected=true;
  }
  const beforeB=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
  // The verifier-only lease fixture cannot establish production ownership authority.
  // Independently demand a durable production recovery-owner lease record, not the fixture.
  const ownerCollections=(await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name).filter(n=>/movie_mentor.*(chargeback|recovery).*lease|movie_mentor.*recovery.*owner/i.test(n));
  let productionOwnerProof=false;
  for(const name of ownerCollections){
   const record=await db.collection(name).findOne({domain:"completed-chargeback"});
   if(record&&typeof record.owner==="string"&&Number.isSafeInteger(record.generation)&&record.generation>=1)productionOwnerProof=true;
  }
  // Collect independent observations before asserting, so one RED cannot hide another.
  const sharedTransaction=observedFinancialWrites.some(w=>observedOwnerWrites.some(o=>o.lsid===w.lsid&&o.txn===w.txn));
  const noStaleFinancialEffect=beforeB?.remainingAmountMinor===1200&&beforeB?.chargebackAmountMinor===0&&(beforeB?.chargebackEvents||[]).length===0;
  console.log("AUD REAL OWNER CONTRACT: productionOwnerProof="+productionOwnerProof+"; candidateCollections="+ownerCollections.length+"; verifierFixtureExcluded=true");
  console.log("AUD REAL TRANSACTION COMMANDS: ownerWrites="+observedOwnerWrites.length+"; financialWrites="+observedFinancialWrites.length+"; sharedTransaction="+sharedTransaction);
  console.log("AUD REAL AUTHORITY TRANSACTION BOUNDARY: realWriterSessionSeen="+realWriterSessionSeen);
  console.log("AUD REAL AUTHORITY INTEGRATION FENCE: staleRejected="+staleRejected+"; noStaleFinancialEffect="+noStaleFinancialEffect);
  const failures=[];
  if(!productionOwnerProof)failures.push("PHYSICAL REAL OWNER CONTRACT RED: real recovery did not acquire a durable production owner generation");
  if(!sharedTransaction)failures.push("PHYSICAL SAME-TRANSACTION RED: no durable production owner write and financial ledger write observed in one MongoDB transaction");
  if(!realWriterSessionSeen)failures.push("PHYSICAL REAL-AUTHORITY INTEGRATION RED: financial writer did not enter an ownership-fenced MongoDB transaction");
  if(!noStaleFinancialEffect)failures.push("PHYSICAL STALE-WRITER RED: superseded worker A committed at real financial mutation after durable generation transfer");
  if(!staleRejected)failures.push("PHYSICAL STALE-WRITER RED: worker A must receive a fenced ownership error");
  assert.equal(failures.length,0,failures.join("\n"));
  const workerB=await recoverMovieMentorCompletedChargebacks(recoveryArgs);
  const ledger=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
  assert.equal(ledger.remainingAmountMinor,900);
  assert.equal(ledger.chargebackAmountMinor,300);
  assert.equal((ledger.chargebackEvents||[]).length,1);
  assert.equal(workerB.settled,1,"new durable owner must be able to settle exactly once");
  console.log("AUD REAL AUTHORITY INTEGRATION FENCE GREEN: stale owner rejected at mutation, successor settled once");
 }finally{releaseA?.();liveLedger.findOneAndUpdate=liveUpdate;}

}finally{
 release?.();releaseLedger?.();
 if(model&&originalCreate)model.create=originalCreate;
 if(ledgerModel&&originalLedgerUpdate)ledgerModel.findOneAndUpdate=originalLedgerUpdate;
 mongoose.connection.getClient().off("commandStarted",commandListener);
 await mongoose.disconnect();
}
