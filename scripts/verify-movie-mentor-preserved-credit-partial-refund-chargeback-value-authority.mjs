import assert from "node:assert/strict";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

console.log("Movie Mentor partial-refund -> chargeback exact-value executable authority court");

const paymentReference="pi-413",eventId="evt-dispute-withdrawn-413",disputedAmountMinor=300;
const stripe={
 checkout:{sessions:{create:async()=>({}),expire:async()=>({}),retrieve:async()=>({})}},
 webhooks:{constructEvent:()=>({id:eventId,type:"charge.dispute.funds_withdrawn",livemode:false,data:{object:{payment_intent:paymentReference,amount:disputedAmountMinor,currency:"gbp"}}})}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec-413",successUrl:"https://example.test/s",cancelUrl:"https://example.test/c"});
const normalized=await adapter.normalizeEvent({verifiedDelivery:{verified:true,provider:"stripe",event:stripe.webhooks.constructEvent()}});
assert.equal(normalized.commercialReversal,true);
assert.equal(normalized.reversalKind,"dispute");
assert.equal(normalized.reversalAmountMinor,disputedAmountMinor,"real production adapter must preserve exact withdrawn dispute amount");

const status=(domain,extra={})=>({domain,production:true,processLocalFallback:false,...extra});
const purchaseIntentAuthority={
 getStatus:()=>status("iband.movie-mentor.production-commercial-purchase-intent-authority",{durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true}),
 resolvePurchaseIntent:async()=>({commercialIntentId:"intent-413",principalId:"creator-413",provider:"stripe",amountMinor:1200,currency:"GBP",units:20})
};
const checkoutBindingAuthority={
 getStatus:()=>status("iband.movie-mentor.production-commercial-checkout-authority",{durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true}),
 resolveCheckoutBinding:async()=>null,bindProviderPaymentReference:async()=>null,
 resolveCheckoutBindingByProviderPaymentReference:async()=>({provider:"stripe",providerPaymentReference:paymentReference,status:"completed",commercialIntentId:"intent-413"}),
 revokeOpenCheckoutsForPrincipal:async()=>({revoked:true})
};
const issuanceAuthority={getStatus:()=>status("iband.movie-mentor.production-entitlement-issuance-authority",{durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true}),issueVerifiedEvidence:async()=>({})};
const reversalAuthority={
 getStatus:()=>status("iband.movie-mentor.production-commercial-reversal-authority",{durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true}),
 suspendVerifiedReversal:async()=>({suspended:true,principalId:"creator-413"}),preserveVerifiedReversalHistory:async()=>({}),reconcilePendingReversals:async()=>({reconciled:true,count:0,results:[]})
};
let settlement=null;
const dispositionAuthority={
 getStatus:()=>status("iband.movie-mentor.production-commercial-value-disposition-authority",{durablePreservedValue:true,paymentIdentityUnique:true,commercialIntentBinding:true,principalBinding:true,exactValueBinding:true,idempotentRetry:true,refundSeparate:true}),
 preserveVerifiedPaidValue:async()=>({}),
 terminallySettlePreservedValue:async input=>(settlement=input,{settled:true})
};
const ingress=createMovieMentorCommercialProviderIngressAuthority({providers:{stripe:adapter},purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority,reversalAuthority,dispositionAuthority});
await ingress.processProviderDelivery({provider:"stripe",delivery:{rawBody:Buffer.from("{}"),signature:"sig"}});
assert.ok(settlement,"funds-withdrawn must reach production chargeback settlement");
assert.equal(settlement.disposition,"chargeback");
assert.equal(normalized.reversalAmountMinor,disputedAmountMinor);
assert.equal(settlement.chargebackAmountMinor,disputedAmountMinor,"exact Stripe funds-withdrawn amount must survive into chargeback settlement authority");
assert.equal(settlement.amountMinor,1200);
assert.equal(settlement.disposition,"chargeback");
const dispositionSource=(await import("node:fs")).readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");
assert.match(dispositionSource,/chargebackAmountMinor=input\.chargebackAmountMinor/,"repaired disposition owner must consume exact chargeback amount");
assert.match(dispositionSource,/CHARGEBACK_VALUE_CONFLICT/,"repaired disposition owner must reject chargeback value beyond remaining preserved value");
assert.match(dispositionSource,/chargebackAmountMinor,remainingAmountMinor:Math\.max\(0,existing\.remainingAmountMinor-chargebackAmountMinor\)/,"repaired disposition owner must durably record exact chargeback and conserve remaining value");
console.log("GREEN: exact Stripe funds-withdrawn amount survives adapter + ingress and is explicitly owned by chargeback disposition accounting.");
