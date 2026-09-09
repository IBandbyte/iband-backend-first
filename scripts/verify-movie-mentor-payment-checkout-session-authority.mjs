import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorStripeCommercialProviderAdapter} from "../ai/MovieMentorStripeCommercialProviderAdapter.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}

const commercialIntentId="intent-checkout-session-binding";
const authorizedCheckoutReference="cs_authorized_movie_mentor";
const rogueCheckoutReference="cs_other_signed_paid_session";
const snapshot={packageId:"creator-20",provider:"stripe",providerProductId:"price-20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"};
const intent=Object.freeze({commercialIntentId,principalId:"creator-1",...snapshot,policyDigest:digest(snapshot),status:"created"});

const signedPaidEvent=Object.freeze({
  id:"evt_checkout_session_binding",
  type:"checkout.session.completed",
  livemode:true,
  data:{object:{
    id:rogueCheckoutReference,
    client_reference_id:commercialIntentId,
    metadata:{commercialIntentId,providerProductId:"price-20"},
    payment_status:"paid",
    amount_total:1200,
    currency:"gbp"
  }}
});

const stripe={
  checkout:{sessions:{create:async()=>{throw new Error("checkout creation is outside this payment-evidence court");}}},
  webhooks:{constructEvent(){return signedPaidEvent;}}
};
const adapter=createMovieMentorStripeCommercialProviderAdapter({stripe,webhookSecret:"whsec_test",successUrl:"https://app.example/success",cancelUrl:"https://app.example/cancel"});
const delivery={rawBody:Buffer.from("signed-provider-delivery"),signature:"sig"};

const purchaseIntentAuthority={
  resolvePurchaseIntent:async({commercialIntentId:id})=>id===commercialIntentId?intent:null,
  getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false})
};

let issuanceCalls=0;
const issuanceAuthority={
  issueVerifiedEvidence:async({evidence})=>{issuanceCalls++;return Object.freeze({issued:true,evidence});},
  getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false})
};

const checkoutBindingAuthority={
  resolve:async({commercialIntentId:id})=>id===commercialIntentId?Object.freeze({commercialIntentId,provider:"stripe",idempotencyKey:`movie-mentor:${commercialIntentId}`,status:"completed",checkoutReference:authorizedCheckoutReference,checkoutUrl:"https://checkout.example/authorized",expiresAt:"2035-01-01T00:00:00.000Z"}):null,
  getStatus:()=>Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false})
};

const verified=await adapter.verifyDelivery({delivery});
const normalized=await adapter.normalizeEvent({verifiedDelivery:verified});
assert.equal(normalized.commercialIntentId,commercialIntentId);
assert.equal(normalized.commerciallyFinal,true);
assert.notEqual(rogueCheckoutReference,authorizedCheckoutReference);

const ingress=createMovieMentorCommercialProviderIngressAuthority({
  providers:{stripe:adapter},
  purchaseIntentAuthority,
  checkoutBindingAuthority,
  issuanceAuthority
});

await assert.rejects(
  ()=>ingress.processProviderDelivery({provider:"stripe",delivery}),
  error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_EVIDENCE_CHECKOUT_BINDING_MISMATCH",
  "A signed paid provider event from a different checkout session must not borrow the purchase intent's entitlement authority."
);
assert.equal(issuanceCalls,0,"Checkout-session mismatch must fail before entitlement issuance.");

console.log("GREEN: verified commercial payment evidence is bound to the exact durable Movie Mentor checkout session before entitlement issuance.");
console.log("LAW: A SIGNED PAID PROVIDER EVENT MAY PROVE PAYMENT HISTORY; IT MAY NOT BORROW ENTITLEMENT AUTHORITY FROM A DIFFERENT CHECKOUT SESSION.");
