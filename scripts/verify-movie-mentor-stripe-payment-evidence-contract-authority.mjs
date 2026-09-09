import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import {createMovieMentorCommercialPaymentEvidenceAuthority} from "../ai/MovieMentorCommercialPaymentEvidenceAuthority.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

const stage=process.argv[2]||"full";
const commercialIntentId="intent-stripe-contract";
const snapshot={packageId:"creator-20",provider:"stripe",providerProductId:"price-20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"};
const intent=Object.freeze({commercialIntentId,principalId:"creator-1",...snapshot,policyDigest:digest(snapshot),status:"created"});
const signedEvent=Object.freeze({id:"evt_contract_1",type:"checkout.session.completed",livemode:true,data:{object:{client_reference_id:commercialIntentId,metadata:{commercialIntentId,providerProductId:"price-20"},payment_status:"paid",amount_total:1200,currency:"gbp"}}});
const stripe={checkout:{sessions:{create:async()=>{throw new Error("checkout creation is not part of this court");}}},webhooks:{constructEvent(){return signedEvent;}}};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_test",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
const delivery={rawBody:Buffer.from("signed"),signature:"sig"};
const purchaseIntentAuthority={resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})};

async function proveAdapter(){
  const verified=await adapter.verifyDelivery({delivery});
  const normalized=await adapter.normalizeEvent({verifiedDelivery:verified});
  assert.equal(normalized.eventId,"evt_contract_1","Stripe normalization must expose the consumer-owned eventId coordinate");
  assert.equal(normalized.eventKind,"checkout.session.completed","Stripe normalization must expose the consumer-owned eventKind coordinate");
  assert.equal(normalized.commerciallyFinal,true);
  return normalized;
}

async function proveEvidence(){
  const evidenceAuthority=createMovieMentorCommercialPaymentEvidenceAuthority({verifyDelivery:({delivery:rawDelivery})=>adapter.verifyDelivery({delivery:rawDelivery}),normalizeEvent:({verifiedDelivery})=>adapter.normalizeEvent({verifiedDelivery}),resolvePurchaseIntent:purchaseIntentAuthority.resolvePurchaseIntent});
  const evidence=await evidenceAuthority.verifyCommercialDelivery({delivery});
  assert.equal(evidence.verified,true);
  assert.equal(evidence.evidenceId,"evt_contract_1");
  assert.equal(evidence.evidenceKind,"checkout.session.completed");
  assert.equal(evidence.commercialReference,commercialIntentId);
  return evidence;
}

async function proveFullIngress(){
  let issuedEvidence=null;
  const issuanceAuthority={issueVerifiedEvidence:async({evidence})=>{issuedEvidence=evidence;return Object.freeze({issued:true,evidence});},getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})};
  const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{stripe:adapter},purchaseIntentAuthority,issuanceAuthority});
  const result=await ingress.processProviderDelivery({provider:"stripe",delivery});
  assert.equal(result?.issued,true,"a valid signed paid Stripe checkout event must cross the production payment-evidence contract into issuance");
  assert.equal(issuedEvidence?.evidenceId,"evt_contract_1","provider event identity must cross the adapter/evidence boundary under the consumer-owned coordinate");
  assert.equal(issuedEvidence?.evidenceKind,"checkout.session.completed","provider event kind must cross the adapter/evidence boundary under the consumer-owned coordinate");
  assert.equal(issuedEvidence?.commercialReference,commercialIntentId);
}

if(stage==="adapter")await proveAdapter();
else if(stage==="evidence")await proveEvidence();
else if(stage==="full"){await proveAdapter();await proveEvidence();await proveFullIngress();}
else throw new Error(`Unknown court stage: ${stage}`);

console.log(`GREEN: Stripe payment evidence contract stage ${stage} crossed its exact production-owned boundary.`);
console.log("LAW: A PROVIDER ADAPTER DOES NOT OWN PAYMENT EVIDENCE UNTIL THE CONSUMING AUTHORITY CAN READ ITS EXACT EVIDENCE COORDINATES.");
