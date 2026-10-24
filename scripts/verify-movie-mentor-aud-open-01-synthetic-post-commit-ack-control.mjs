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
async function verifySignedIngressRetry(){
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

  // Synthetic post-commit acknowledgement loss. This is NOT a genuine network-level
  // MongoDB UnknownTransactionCommitResult and must never be reported as one.
  const originalStartSession=mongoose.startSession;
  let injected=0;
  mongoose.startSession=async function(...args){
    const session=await originalStartSession.apply(this,args);
    const originalWithTransaction=session.withTransaction.bind(session);
    session.withTransaction=async function(fn,options){
      const result=await originalWithTransaction(fn,options);
      if(injected++===0)throw Error("AUD_SYNTHETIC_POST_COMMIT_ACK_LOSS");
      return result;
    };
    return session;
  };
  try{
    await assert.rejects(()=>ingress.authority.ingest({provider:"stripe",delivery}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_REVERSAL_AUTHORITY_UNAVAILABLE"&&/AUD_SYNTHETIC_POST_COMMIT_ACK_LOSS/.test(e.message));
  }finally{mongoose.startSession=originalStartSession;}
  assert.equal(injected,1,"synthetic acknowledgement-loss injection must fire exactly once");
  const receipt=await db.collection("movie_mentor_commercial_reversal").findOne({evidenceSource:"stripe",evidenceId});
  assert.ok(receipt,"reversal must be independently observed durable after caller failure");
  const entitlement=await db.collection("movie_mentor_inference_entitlement").findOne({principalId});
  assert.equal(entitlement?.status,"suspended","entitlement and reversal must commit atomically");
  await new Promise(resolve=>setTimeout(resolve,1500));
  let row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment});
  assert.notEqual(row?.chargebackAmountMinor,300,"caller must not have scheduled own success-path timer after acknowledgement loss");
  const recovery=await recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority});
  assert.equal(recovery.complete,true);
  assert.equal(recovery.settled,1,"startup-style recovery must settle durable orphan");
  row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment});
  assert.equal(row?.chargebackAmountMinor,300);
  assert.equal(row?.remainingAmountMinor,900);
  assert.equal((row.chargebackEvents||[]).filter(e=>e.reference===eventId).length,1);
  const again=await recoverMovieMentorCompletedChargebacks({reversalAuthority:reversal.authority,purchaseIntentAuthority:purchase.authority,checkoutBindingAuthority:checkout.authority,dispositionAuthority:value.authority});
  assert.equal(again.alreadySettled,1);
  assert.equal((await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:payment})).chargebackEvents.filter(e=>e.reference===eventId).length,1);
  console.log("AUD SYNTHETIC POST-COMMIT ACK CONTROL GREEN: durable reversal, caller failure, no own timer, startup-style recovery settled exactly once; genuine MongoDB acknowledgement loss NOT established");
 }finally{await mongoose.disconnect();}
}
await verifySignedIngressRetry();
