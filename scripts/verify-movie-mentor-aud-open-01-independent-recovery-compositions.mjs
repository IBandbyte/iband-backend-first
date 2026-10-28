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
 const recoveryArgs={reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority,pageLimit:1};
 // Independently composed production authorities share only the durable database.
 const purchase2=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>{throw Error("NO_POLICY_MINT");}});
 const issuance2=createMovieMentorProductionEntitlementIssuanceComposition();
 const reversal2=createMovieMentorProductionCommercialReversalComposition();
 const value2=createMovieMentorProductionCommercialValueDispositionComposition();
 const checkout2=createMovieMentorProductionCommercialCheckoutComposition({purchaseIntentAuthority:purchase2.authority,entitlementAuthority:issuance2.authority,providers:{stripe:adapter}});
 for(const composition of [purchase2,issuance2,reversal2,value2,checkout2])assert.equal(composition.ready,true,"independent production authority composition must be ready");
 for(const [first,second] of [[purchase.authority,purchase2.authority],[reversal.authority,reversal2.authority],[value.authority,value2.authority],[checkout.authority,checkout2.authority]])assert.notEqual(first,second,"workers must not share authority object identity");
 const secondArgs={reversalAuthority:reversal2.authority,purchaseIntentAuthority:purchase2.authority,checkoutBindingAuthority:checkout2.authority,dispositionAuthority:value2.authority,pageLimit:1};
 const firstPromise=recoverMovieMentorCompletedChargebacks(recoveryArgs);
 await ledgerEntered;
 // Start another real recovery before the held earlier-ID reversal commits.
 const secondPromise=recoverMovieMentorCompletedChargebacks(secondArgs);
 await new Promise(resolve=>setTimeout(resolve,250));
 release();
 const aResult=await a;
 assert.equal(aResult.reversalId,earlyId,"earlier-generated reversal must commit while first recovery remains active");
 releaseLedger();
 const outcomes=await Promise.allSettled([firstPromise,secondPromise]);
 assert.equal(outcomes.every(o=>o.status==="fulfilled"),true,"both concurrent recoveries must finish without an infrastructure exception");
 assert.equal(outcomes.every(o=>o.value.complete===true),true,"both scans must claim completion");
 const pending=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(pending.remainingAmountMinor,1200,"late committed reversal remains financially unsettled after earlier scan");
 assert.equal(pending.chargebackAmountMinor,0);
 const [second,third]=await Promise.all([recoverMovieMentorCompletedChargebacks({...recoveryArgs,maxPages:100}),recoverMovieMentorCompletedChargebacks({...secondArgs,maxPages:100})]);
 assert.equal(second.complete,true);
 assert.equal(second.settled+third.settled,1,"independent workers must report only one successful late settlement");
 const settled=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-ledger-A"});
 assert.equal(settled.remainingAmountMinor,900);
 assert.equal(settled.chargebackAmountMinor,300);
 assert.equal((settled.chargebackEvents||[]).filter(event=>event.reference==="evt-ledger-A").length,1,"independent workers must not duplicate the durable chargeback event");
 console.log("INDEPENDENT PRODUCTION COMPOSITIONS GREEN: two independent recovery authorities; one durable chargeback CAS and event; exact-once concurrent replay");
}finally{
 release?.();releaseLedger?.();
 if(model&&originalCreate)model.create=originalCreate;
 if(ledgerModel&&originalLedgerUpdate)ledgerModel.findOneAndUpdate=originalLedgerUpdate;
 await mongoose.disconnect();
}
