import assert from "node:assert/strict";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const CHECKOUT_DOMAIN="iband.movie-mentor.production-commercial-checkout-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";
const REVERSAL_DOMAIN="iband.movie-mentor.production-commercial-reversal-authority";

const checkout={
 commercialIntentId:"intent-out-of-order-1",provider:"stripe",status:"completed",checkoutReference:"cs_out_of_order_1",providerPaymentReference:null
};
let suspended=0;
const adapter={
 verifyDelivery:async({delivery})=>({verified:true,payload:delivery}),
 normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,
 getStatus:()=>({domain:ADAPTER_DOMAIN,provider:"stripe",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,providerPaymentReferenceEvidence:true,commercialReversalEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false})
};
const purchase={resolvePurchaseIntent:async()=>({commercialIntentId:checkout.commercialIntentId,principalId:"creator-ooo-1",provider:"stripe"}),getStatus:()=>({domain:PURCHASE_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})};
const checkoutAuthority={
 resolveCheckoutBinding:async()=>checkout,
 bindProviderPaymentReference:async({commercialIntentId,provider,checkoutReference,providerPaymentReference})=>{assert.equal(commercialIntentId,checkout.commercialIntentId);assert.equal(provider,"stripe");assert.equal(checkoutReference,checkout.checkoutReference);checkout.providerPaymentReference=providerPaymentReference;return checkout;},
 resolveCheckoutBindingByProviderPaymentReference:async({provider,providerPaymentReference})=>provider==="stripe"&&checkout.providerPaymentReference===providerPaymentReference?checkout:null,
 getStatus:()=>({domain:CHECKOUT_DOMAIN,production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})
};
const issuance={issueVerifiedEvidence:async()=>({authorized:true}),getStatus:()=>({domain:ISSUANCE_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})};
const reversal={suspendVerifiedReversal:async()=>{suspended+=1;return {suspended:true};},getStatus:()=>({domain:REVERSAL_DOMAIN,production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,processLocalFallback:false})};
const authority=createMovieMentorCommercialProviderIngressAuthority({providers:{stripe:adapter},purchaseIntentAuthority:purchase,checkoutBindingAuthority:checkoutAuthority,issuanceAuthority:issuance,reversalAuthority:reversal});
const reversalEvent={provider:"stripe",eventId:"evt_refund_first",eventKind:"charge.refunded",providerPaymentReference:"pi_out_of_order_1",commerciallyFinal:false,commercialReversal:true,reversalAmountMinor:1000,currency:"GBP"};
let firstError=null;
try{await authority.processProviderDelivery({provider:"stripe",delivery:reversalEvent});}catch(error){firstError=error;}
assert.equal(firstError,null,"Verified reversal arriving before paid checkout evidence must not be discarded merely because payment lineage has not yet been bound.");
assert.equal(suspended,0,"Reversal must not suspend an entitlement before exact payment lineage is proven.");
await authority.processProviderDelivery({provider:"stripe",delivery:{provider:"stripe",eventId:"evt_paid_later",eventKind:"checkout.session.completed",commercialIntentId:checkout.commercialIntentId,checkoutReference:checkout.checkoutReference,providerPaymentReference:"pi_out_of_order_1",providerProductId:"price_x",amountMinor:1000,currency:"GBP",environment:"test",commerciallyFinal:false,commercialReversal:false}});
assert.equal(checkout.providerPaymentReference,"pi_out_of_order_1");
assert.equal(suspended,1,"Once exact payment lineage becomes durable, the earlier verified reversal must become current suspension authority without requiring provider redelivery.");
console.log("LAW: VERIFIED REVERSAL MAY ARRIVE BEFORE PAYMENT LINEAGE; IT MUST FAIL CLOSED FOR FORWARD AUTHORITY WITHOUT BEING LOST AS HISTORY, THEN RECONCILE WHEN EXACT LINEAGE BECOMES DURABLE.");
console.log("reversal-before-payment-lineage authority: GREEN");
