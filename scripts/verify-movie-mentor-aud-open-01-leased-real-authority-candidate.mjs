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
 const recoveryArgs={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1};
 // Verifier-only durable lease candidate: the database elects B after A expires.
 // Recovery still uses the real owner-proven production financial authorities.
 const leases=db.collection("aud_open_01_real_authority_lease_candidate");
 await leases.createIndex({domain:1},{unique:true});
 const leaseKey={domain:"stripe-chargeback-reconciliation"};
 await leases.insertOne({...leaseKey,owner:"A",generation:1,leaseUntil:new Date(0),cursor:"receipt-010"});
 const takeover=await leases.findOneAndUpdate({...leaseKey,owner:"A",generation:1,$expr:{$lte:["$leaseUntil","$$NOW"]}},[{$set:{owner:"B",generation:{$add:["$generation",1]},leaseUntil:{$dateAdd:{startDate:"$$NOW",unit:"minute",amount:5}}}}],{returnDocument:"after"});
 assert.equal(takeover?.generation,2);
 const stale=await leases.updateOne({...leaseKey,owner:"A",generation:1,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$set:{cursor:"forged-past-late-receipt"}});
 assert.equal(stale.matchedCount,0,"stale A must not advance B's checkpoint");
 const ownerB=await leases.findOne({...leaseKey,owner:"B",generation:2,$expr:{$gt:["$leaseUntil","$$NOW"]}});
 assert.ok(ownerB,"only B may run under current server-time lease");
 const [workerA,workerB]=await Promise.all([
  recoverMovieMentorCompletedChargebacks(recoveryArgs),
  recoverMovieMentorCompletedChargebacks(recoveryArgs)
 ]);
 assert.equal(workerA.complete,true);
 assert.equal(workerB.complete,true);
 assert.equal(workerA.settled+workerB.settled,1,"concurrent recovery workers must apply the late chargeback once in total");
 const settled=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(settled.remainingAmountMinor,900,"concurrent workers must preserve exact remaining value");
 assert.equal(settled.chargebackAmountMinor,300);
 assert.equal((settled.chargebackEvents||[]).length,1,"concurrent workers must not duplicate financial event");
 // Deterministic interrupted-worker court: B completes real financial replay, then
 // loses its lease before it can commit its checkpoint. C must take over.
 // This is verifier-only lease orchestration, NOT production lease enforcement.
 const expireB=await leases.updateOne({...leaseKey,owner:"B",generation:2},{$set:{leaseUntil:new Date(0)}});
 assert.equal(expireB.matchedCount,1,"interrupted B must have owned the prior generation");
 const takeoverC=await leases.findOneAndUpdate({...leaseKey,owner:"B",generation:2,$expr:{$lte:["$leaseUntil","$$NOW"]}},[{$set:{owner:"C",generation:{$add:["$generation",1]},leaseUntil:{$dateAdd:{startDate:"$$NOW",unit:"minute",amount:5}}}}],{returnDocument:"after"});
 assert.equal(takeoverC?.generation,3,"successor must acquire a new generation");
 const interruptedCheckpoint=await leases.updateOne({...leaseKey,owner:"B",generation:2,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$set:{cursor:"forged-after-interruption",cycle:2}});
 assert.equal(interruptedCheckpoint.matchedCount,0,"interrupted B must not checkpoint after C takeover");
 const successor=await recoverMovieMentorCompletedChargebacks(recoveryArgs);
 assert.equal(successor.complete,true,"successor must finish a full real-authority recovery cycle");
 assert.equal(successor.settled,0,"successor must not duplicate already durable financial settlement");
 const checkpoint=await leases.updateOne({...leaseKey,owner:"C",generation:3,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$set:{cursor:null,cycle:2}});
 assert.equal(checkpoint.matchedCount,1,"current successor must checkpoint the completed replay cycle");
 const forged=await leases.updateOne({...leaseKey,owner:"A",generation:1},{$set:{cursor:"forged"}});
 assert.equal(forged.matchedCount,0);
 const observedLease=await leases.findOne(leaseKey);
 assert.equal(observedLease.owner,"C");
 assert.equal(observedLease.generation,3);
 assert.equal(observedLease.cursor,null);
 assert.equal(observedLease.cycle,2);
 const replay=await recoverMovieMentorCompletedChargebacks(recoveryArgs);
 assert.equal(replay.settled,0,"subsequent full-cycle replay must not apply a second settlement");
 assert.ok(replay.alreadySettled>=3,"replay must observe previously settled receipts");
 console.log("AUD LEASED REAL-AUTHORITY REPLAY CANDIDATE GREEN: late commit recovered under concurrent scanners with one durable financial effect");

}finally{
 release?.();releaseLedger?.();
 if(model&&originalCreate)model.create=originalCreate;
 if(ledgerModel&&originalLedgerUpdate)ledgerModel.findOneAndUpdate=originalLedgerUpdate;
 await mongoose.disconnect();
}
