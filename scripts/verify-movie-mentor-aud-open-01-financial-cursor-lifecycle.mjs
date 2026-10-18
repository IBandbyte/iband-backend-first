import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";
import {createMovieMentorProductionEntitlementIssuanceComposition} from "../ai/MovieMentorProductionEntitlementIssuanceComposition.js";
import {createMovieMentorProductionCommercialCheckoutComposition} from "../ai/MovieMentorProductionCommercialCheckoutComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {recoverMovieMentorCompletedChargebacks} from "../ai/MovieMentorCompletedChargebackRecovery.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let release,signal,model,originalCreate;
const held=new Promise(r=>release=r),entered=new Promise(r=>signal=r);
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName);
 const purchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 const checkout=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase.authority,entitlementAuthority:issuance.authority,providers:{}});
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
 const first=await recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1});
 assert.equal(first.complete,true);
 assert.equal(first.settled,2);
 release();
 const aResult=await a;
 assert.equal(aResult.reversalId,earlyId);
 const pending=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(pending.remainingAmountMinor,1200,"late committed reversal remains financially unsettled after earlier scan");
 assert.equal(pending.chargebackAmountMinor,0);
 const second=await recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1});
 assert.equal(second.complete,true);
 assert.equal(second.settled,1,"fresh scan must discover late committed reversal");
 const settled=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(settled.remainingAmountMinor,900);
 assert.equal(settled.chargebackAmountMinor,300);
 console.log("FINANCIAL CURSOR COURT: first recovery completed before late commit; ledger unsettled; fresh scan settled exactly once");
}finally{
 release?.();
 if(model&&originalCreate)model.create=originalCreate;
 await mongoose.disconnect();
}
