import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
const commercialIntentId="intent-reversal-1",checkoutReference="cs_reversal_1",providerPaymentReference="pi_reversal_1";
const snapshot={packageId:"creator-20",provider:"stripe",providerProductId:"price-20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"};
const intent=Object.freeze({commercialIntentId,principalId:"creator-1",...snapshot,policyDigest:digest(snapshot),status:"created"});
let currentEvent=null;
const stripe={checkout:{sessions:{create:async()=>{throw new Error("checkout creation is outside this court");}}},webhooks:{constructEvent(){return currentEvent;}}};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_test",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
const purchaseIntentAuthority={resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})};
let boundPaymentReference=null;
const checkoutBindingAuthority={resolveCheckoutBinding:async({commercialIntentId:id})=>id===commercialIntentId?Object.freeze({commercialIntentId,provider:"stripe",status:"completed",checkoutReference,providerPaymentReference:boundPaymentReference}):null,bindProviderPaymentReference:async({commercialIntentId:id,checkoutReference:ref,providerPaymentReference:paymentRef})=>{assert.equal(id,commercialIntentId);assert.equal(ref,checkoutReference);boundPaymentReference=paymentRef;return Object.freeze({commercialIntentId,provider:"stripe",status:"completed",checkoutReference,providerPaymentReference:paymentRef});},resolveCheckoutBindingByProviderPaymentReference:async({provider,providerPaymentReference:paymentRef,paymentReference})=>{const ref=paymentRef||paymentReference;return provider==="stripe"&&ref===boundPaymentReference?Object.freeze({commercialIntentId,provider:"stripe",status:"completed",checkoutReference,providerPaymentReference:ref}):null;},getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})};
let issuanceCalls=0;
const issuanceAuthority={issueVerifiedEvidence:async()=>{issuanceCalls++;return Object.freeze({authorized:true});},getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})};
let reversalCalls=0;
const reversalAuthority={suspendVerifiedReversal:async({reversal})=>{reversalCalls++;assert.equal(reversal.providerPaymentReference,providerPaymentReference);assert.equal(reversal.commercialReference,commercialIntentId);assert.equal(reversal.principalId,"creator-1");return Object.freeze({suspended:true,idempotent:false});},getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,processLocalFallback:false})};
const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{stripe:adapter},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority});
const delivery={rawBody:Buffer.from("signed"),signature:"sig"};
currentEvent=Object.freeze({id:"evt_paid_reversal_1",type:"checkout.session.completed",livemode:true,data:{object:{id:checkoutReference,client_reference_id:commercialIntentId,payment_intent:providerPaymentReference,metadata:{commercialIntentId,providerProductId:"price-20"},payment_status:"paid",amount_total:1200,currency:"gbp"}}});
await ingress.processProviderDelivery({provider:"stripe",delivery});
assert.equal(issuanceCalls,1,"paid checkout must still reach entitlement issuance");assert.equal(boundPaymentReference,providerPaymentReference,"successful payment evidence must durably bind provider payment identity to the exact checkout session before reversal can borrow it");
currentEvent=Object.freeze({id:"evt_refund_reversal_1",type:"charge.refunded",livemode:true,data:{object:{id:"ch_reversal_1",payment_intent:providerPaymentReference,refunded:true,amount:1200,amount_refunded:1200,currency:"gbp"}}});
const reversed=await ingress.processProviderDelivery({provider:"stripe",delivery});
assert.equal(reversalCalls,1,"verified refund must cross durable reversal authority exactly once");assert.equal(reversed?.suspended,true,"verified refund must suspend forward entitlement authority pending reconciliation");
console.log("GREEN: verified provider reversal is bound through durable payment identity to the exact Movie Mentor checkout and suspends forward entitlement authority.");
console.log("LAW: PAYMENT HISTORY MAY SURVIVE A REFUND OR DISPUTE; FORWARD ENTITLEMENT AUTHORITY MAY NOT.");
