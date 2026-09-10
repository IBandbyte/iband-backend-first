import assert from "node:assert/strict";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";
import {createMovieMentorProductionCommercialPurchaseIntentComposition} from "../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js";

const purchaseSnapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const oldMongo=process.env.MONGO_URI;
process.env.MONGO_URI="mongodb://configured.example/test";
const ownedPurchase=createMovieMentorProductionCommercialPurchaseIntentComposition({resolveCommercialPolicy:async()=>purchaseSnapshot});
if(oldMongo===undefined)delete process.env.MONGO_URI;else process.env.MONGO_URI=oldMongo;

const checkoutStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,providerPaymentReferenceBinding:true,providerPaymentReferenceResolution:true,openCheckoutRevocation:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const checkout=Object.freeze({resolveCheckoutBinding:async()=>null,bindProviderPaymentReference:async()=>null,resolveCheckoutBindingByProviderPaymentReference:async()=>null,revokeOpenCheckoutsForPrincipal:async()=>Object.freeze({revoked:true,count:0}),getStatus:()=>checkoutStatus});
const forgedIssuanceStatus=Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,entitlementMutationAtomic:true,issuanceReceiptDurable:true,currentEntitlementRead:true,ownerBoundProof:true,processLocalFallback:false});
const forgedIssuance=Object.freeze({issueVerifiedEvidence:async()=>Object.freeze({authorized:true}),getStatus:()=>forgedIssuanceStatus});
const reversalStatus=Object.freeze({domain:"iband.movie-mentor.production-commercial-reversal-authority",production:true,durableAtomicSuspension:true,reversalIdentityUnique:true,currentEntitlementSuspension:true,reversalReceiptDurable:true,pendingReversalHistoryDurable:true,pendingReversalIdentityUnique:true,pendingReversalReconciliation:true,processLocalFallback:false});
const reversal=Object.freeze({suspendVerifiedReversal:async()=>Object.freeze({suspended:true}),preserveVerifiedReversalHistory:async()=>Object.freeze({preserved:true}),reconcilePendingReversals:async()=>Object.freeze({reconciled:true,count:0}),getStatus:()=>reversalStatus});

assert.throws(
 ()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:ownedPurchase.authority,checkoutBindingAuthority:checkout,issuanceAuthority:forgedIssuance,reversalAuthority:reversal,providers:{}}),
 error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED",
 "self-asserted issuance status must earn zero provider-ingress authority without entitlement composer's exact owner proof"
);

console.log("provider-ingress issuance owner-proof torture: GREEN");
console.log("LAW: PROVIDER INGRESS MAY NOT BORROW ENTITLEMENT-ISSUANCE AUTHORITY FROM A SELF-ASSERTED STATUS OBJECT; ONLY THE PRODUCTION ENTITLEMENT COMPOSER THAT OWNS THE PROOF MAY AUTHORIZE ISSUANCE.");
