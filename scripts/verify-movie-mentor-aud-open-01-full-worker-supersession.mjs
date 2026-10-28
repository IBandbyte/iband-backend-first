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

 // Hold worker A after the real recovery entry point acquires its minted
 // capability but BEFORE the financial transaction opens. The isolated DB
 // advances lease expiry; worker B then takes over the genuine lease document.
 const originalStartSession=mongoose.connection.startSession.bind(mongoose.connection);
 let signal,release;
 const entered=new Promise(r=>signal=r),held=new Promise(r=>release=r);
 let intercepted=false;
 mongoose.connection.startSession=async function(...params){
  if(!intercepted){intercepted=true;signal();await held;}
  return originalStartSession(...params);
 };
 restore=()=>{mongoose.connection.startSession=originalStartSession;release?.();};
 const first=recoverMovieMentorCompletedChargebacks(args).then(
  result=>({ok:true,result}),error=>({ok:false,error})
 );
 await Promise.race([entered,new Promise((_,reject)=>setTimeout(()=>reject(Error("worker A did not reach pre-transaction gate")),10000))]);
 const leases=db.collection(MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION);
 const ownerA=await leases.findOne({_id:"completed-chargeback:stripe"});
 assert.ok(ownerA&&ownerA.generation>=1&&typeof ownerA.owner==="string","worker A must own real durable lease");
 // Controlled isolated-test expiry, never a fake owner fixture or production write.
 const expired=await leases.updateOne(
  {_id:"completed-chargeback:stripe",owner:ownerA.owner,generation:ownerA.generation},
  {$set:{leaseUntil:new Date(0)}}
 );
 assert.equal(expired.modifiedCount,1,"isolation must expire only the exact old generation");
 const successor=await recoverMovieMentorCompletedChargebacks(args);
 assert.equal(successor.complete,true);
 assert.equal(successor.settled,2,"real successor must settle both pending reversals");
 const ownerB=await leases.findOne({_id:"completed-chargeback:stripe"});
 assert.ok(ownerB.generation>ownerA.generation&&ownerB.owner!==ownerA.owner,"durable generation takeover must occur");
 release();
 const stale=await first;
 assert.equal(stale.ok,false,"superseded worker must not complete using stale capability");
 assert.equal(stale.error?.code,"MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED","stale financial transaction must be rejected by real fence");
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
 const finalLease=await leases.findOne({_id:"completed-chargeback:stripe"});
 assert.equal(finalLease.generation,ownerB.generation,"settled-only replay must not acquire another generation");
 assert.equal(finalLease.owner,ownerB.owner,"stale worker must not displace the successful successor");
 console.log("AUD FULL WORKER SUPERSESSION GREEN: old worker acquired genuine lease then expired before transaction; successor took over and settled exactly once; old worker fenced without financial mutation; replay idempotent.");

}finally{restore();await mongoose.disconnect();}
