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
import {MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION} from "../ai/MovieMentorCompletedChargebackRecoveryOwnerInternal.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let restore=()=>{};
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"physical replica set required");
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 const stripe=new Stripe("sk_test_aud_open_01_no_network");
 const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_aud_open_01_financial",successUrl:"https://example.invalid/success",cancelUrl:"https://example.invalid/cancel"});
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{stripe:adapter}});
 for(const c of [purchase,issuance,reversal,value,checkout])assert.equal(c.ready,true);
 await purchase.authority.resolvePurchaseIntent({commercialIntentId:"index-ready-probe"});
 await checkout.authority.resolveCheckoutBinding({commercialIntentId:"index-ready-probe"});
 await reversal.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
 for(const p of ["A","B"]){
  await db.collection("movie_mentor_commercial_purchase_intent").insertOne({domain:"iband.movie-mentor.commercial-purchase-intent",schema:2,commercialIntentId:"intent-worker-"+p,principalId:"principal-worker-"+p,purchaseAttemptDigest:"attempt-"+p,packageId:"aud-package",provider:"stripe",providerProductId:"aud-product",amountMinor:1200,currency:"GBP",environment:"test",units:20,policyVersion:"aud-fixture",policyDigest:"aud-fixture",status:"created",createdAtAuthority:new Date()});
  await db.collection("movie_mentor_commercial_checkout_binding").insertOne({domain:"iband.movie-mentor.commercial-checkout-binding",schema:1,commercialIntentId:"intent-worker-"+p,provider:"stripe",idempotencyKey:"checkout-"+p,status:"completed",checkoutReference:"cs-worker-"+p,checkoutUrl:"https://example.invalid/checkout",providerPaymentReference:"pi-worker-"+p,createdAtAuthority:new Date(),completedAtAuthority:new Date()});
  await db.collection("movie_mentor_inference_entitlement").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"principal-worker-"+p,status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
  await value.authority.preserveVerifiedPaidValue({provider:"stripe",providerPaymentReference:"pi-worker-"+p,commercialIntentId:"intent-worker-"+p,principalId:"principal-worker-"+p,amountMinor:1200,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false});
  await reversal.authority.suspendVerifiedReversal({reversal:{verified:true,evidenceId:"evt-worker-"+p,evidenceSource:"stripe",evidenceKind:"charge.dispute.funds_withdrawn",providerPaymentReference:"pi-worker-"+p,reversalAmountMinor:300,currency:"GBP",verifiedAt:new Date().toISOString(),commercialReference:"intent-worker-"+p,principalId:"principal-worker-"+p}});
 }
 const args={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1,maxPages:100};
 const model=mongoose.model("MovieMentorCommercialValueDisposition");
 const original=model.findOneAndUpdate;
 let signal,release;
 const entered=new Promise(r=>signal=r),held=new Promise(r=>release=r);
 let intercepted=false;
 model.findOneAndUpdate=function(query,update,...options){
  const q=original.call(this,query,update,...options);
  if(!intercepted&&query?.providerPaymentReference==="pi-worker-A"&&update?.$push?.chargebackEvents){
   intercepted=true;
   const lean=q.lean.bind(q);
   q.lean=(...params)=>{const l=lean(...params),exec=l.exec.bind(l);l.exec=(...execArgs)=>{signal();return held.then(()=>exec(...execArgs));};return l;};
  }
  return q;
 };
 restore=()=>{model.findOneAndUpdate=original;release?.();};
 const first=recoverMovieMentorCompletedChargebacks(args);
 await Promise.race([entered,new Promise((_,reject)=>setTimeout(()=>reject(Error("worker A did not enter real financial mutation")),10000))]);
 const leases=db.collection(MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION);
 const ownerA=await leases.findOne({_id:"completed-chargeback:stripe"});
 assert.ok(ownerA&&ownerA.generation>=1&&typeof ownerA.owner==="string","real worker must own genuine durable lease");
 let blocked=null;
 try{await recoverMovieMentorCompletedChargebacks(args);}catch(error){blocked=error;}
 assert.equal(blocked?.code,"MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED","competing worker must not write without ownership");
 const during=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-worker-A"});
 assert.equal(during.chargebackAmountMinor,0,"uncommitted owner transaction cannot expose financial mutation");
 assert.equal((during.chargebackEvents||[]).length,0);
 assert.equal((await leases.findOne({_id:"completed-chargeback:stripe"})).generation,ownerA.generation,"blocked worker must not steal active generation");
 release();
 const completed=await first;
 assert.equal(completed.complete,true);
 assert.equal(completed.settled,2);
 const replay=await recoverMovieMentorCompletedChargebacks(args);
 assert.equal(replay.complete,true);
 assert.equal(replay.settled,0);
 assert.equal(replay.alreadySettled,2);
 for(const p of ["A","B"]){
  const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-worker-"+p});
  assert.equal(row.remainingAmountMinor,900);
  assert.equal(row.chargebackAmountMinor,300);
  assert.equal((row.chargebackEvents||[]).filter(e=>e.reference==="evt-worker-"+p).length,1,"exactly one durable chargeback event");
 }
 assert.ok((await leases.findOne({_id:"completed-chargeback:stripe"})).generation>ownerA.generation,"successor replay must acquire a later real generation");
 console.log("AUD FULL WORKER CONTENTION GREEN: genuine owner held during financial mutation; competing worker fenced without financial effect; original completed; successor replay exactly once.");
}finally{restore();await mongoose.disconnect();}
