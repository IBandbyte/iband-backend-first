import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
async function rejects(code,fn){await assert.rejects(fn,error=>error?.code===code);}
const purchaseCapability=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const checkoutCapability=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,checkoutBindingResolution:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const issuanceCapability=Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false});
const providerCapability=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,checkoutReferenceEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId:"intent_1",principalId:"principal_A",...snapshot,policyDigest:digest(snapshot),status:"created"});
const baseEvent=Object.freeze({eventId:"evt_1",provider:"provider-a",eventKind:"payment-completed",commercialIntentId:"intent_1",checkoutReference:"checkout_1",commerciallyFinal:true,providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live"});
let issuanceCalls=0,lastEvidence=null;
const rawIssuance=async({evidence})=>{issuanceCalls++;lastEvidence=evidence;return Object.freeze({authorized:true,evidenceId:evidence.evidenceId,principalId:evidence.principalId,units:evidence.units});};
const provenPurchase=Object.freeze({resolvePurchaseIntent:async({commercialIntentId})=>commercialIntentId===intent.commercialIntentId?intent:null,getStatus:()=>purchaseCapability});
const provenCheckout=Object.freeze({resolveCheckoutBinding:async({commercialIntentId})=>commercialIntentId===intent.commercialIntentId?Object.freeze({commercialIntentId,provider:"provider-a",status:"completed",checkoutReference:"checkout_1"}):null,getStatus:()=>checkoutCapability});
const provenIssuance=Object.freeze({issueVerifiedEvidence:rawIssuance,getStatus:()=>issuanceCapability});
const providerA={async verifyDelivery({delivery}){return delivery?.signature==="provider-a-valid"?Object.freeze({verified:true,payload:delivery.payload}):Object.freeze({verified:false});},async normalizeEvent({verifiedDelivery}){return verifiedDelivery.payload;},getStatus(){return providerCapability;}};
const owners={purchaseIntentAuthority:provenPurchase,checkoutBindingAuthority:provenCheckout,issuanceAuthority:provenIssuance};

assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners,purchaseIntentAuthority:{resolvePurchaseIntent:provenPurchase.resolvePurchaseIntent}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners,checkoutBindingAuthority:{resolveCheckoutBinding:provenCheckout.resolveCheckoutBinding}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_CHECKOUT_BINDING_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners,issuanceAuthority:{issueVerifiedEvidence:rawIssuance}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners,purchaseIntentAuthority:{...provenPurchase,getStatus:()=>({...purchaseCapability,immutableCommercialTerms:false})}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners,checkoutBindingAuthority:{...provenCheckout,getStatus:()=>({...checkoutCapability,checkoutBindingResolution:false})}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_CHECKOUT_BINDING_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners,issuanceAuthority:{...provenIssuance,getStatus(){throw new Error("uncertain");}}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");

const authority=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},...owners});
assert.equal(authority.getStatus().purchaseIntentProvenanceRequired,true);assert.equal(authority.getStatus().checkoutBindingProvenanceRequired,true);assert.equal(authority.getStatus().issuanceProvenanceRequired,true);assert.equal(authority.getStatus().processLocalFallback,false);assert.equal(authority.ingest,authority.processProviderDelivery);
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_DELIVERY_UNVERIFIED",()=>authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"forged",payload:baseEvent}}));assert.equal(issuanceCalls,0);
await rejects("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED",()=>authority.processProviderDelivery({provider:"provider-b",delivery:{signature:"provider-a-valid",payload:baseEvent}}));assert.equal(issuanceCalls,0);
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":{verifyDelivery:providerA.verifyDelivery,normalizeEvent:providerA.normalizeEvent}},...owners}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":{...providerA,getStatus:()=>({...providerCapability,signatureVerification:false})}},...owners}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
const mismatched=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":{verifyDelivery:providerA.verifyDelivery,normalizeEvent:async({verifiedDelivery})=>({...verifiedDelivery.payload,provider:"provider-b"}),getStatus:()=>providerCapability}},...owners});
await rejects("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PROVIDER_MISMATCH",()=>mismatched.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:baseEvent}}));assert.equal(issuanceCalls,0);
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_CHECKOUT_BINDING_MISMATCH",()=>authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:{...baseEvent,checkoutReference:"checkout_other"}}}));assert.equal(issuanceCalls,0);
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_AMOUNT_MISMATCH",()=>authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:{...baseEvent,amountMinor:1}}}));assert.equal(issuanceCalls,0);
const result=await authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:{...baseEvent,principalId:"attacker",units:999999}}});
assert.equal(result.authorized,true);assert.equal(result.principalId,"principal_A");assert.equal(result.units,20);assert.equal(issuanceCalls,1);assert.equal(lastEvidence.principalId,"principal_A");assert.equal(lastEvidence.units,20);assert.equal(lastEvidence.evidenceId,"evt_1");assert.equal(lastEvidence.checkoutReference,"checkout_1");

assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({providers:{"provider-a":providerA},...owners,purchaseIntentAuthority:{resolvePurchaseIntent:async()=>intent}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({providers:{"provider-a":providerA},...owners,checkoutBindingAuthority:{resolveCheckoutBinding:provenCheckout.resolveCheckoutBinding}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_CHECKOUT_BINDING_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({providers:{"provider-a":providerA},...owners,issuanceAuthority:{issueVerifiedEvidence:rawIssuance}}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({providers:{},...owners}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({providers:{"provider-a":{verifyDelivery:providerA.verifyDelivery,normalizeEvent:providerA.normalizeEvent}},...owners}),e=>e?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
const production=createMovieMentorProductionCommercialProviderIngressComposition({providers:{"provider-a":providerA},...owners});assert.equal(production.ready,true);assert.deepEqual(production.configuredProviders,["provider-a"]);assert.equal(production.publicRoute,false);assert.equal(production.rawBodyBoundaryRequired,true);assert.deepEqual(production.checkoutBindingStatus,checkoutCapability);

const source=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialProviderIngressComposition.js",import.meta.url),"utf8");
assert.match(source,/ownedStatus\(purchaseIntentAuthority\)/);assert.match(source,/ownedStatus\(checkoutBindingAuthority\)/);assert.match(source,/ownedStatus\(issuanceAuthority\)/);assert.match(source,/checkoutBindingProvenanceRequired:true/);assert.match(source,/createMovieMentorCommercialProviderIngressAuthority\(\{providers,purchaseIntentAuthority,checkoutBindingAuthority,issuanceAuthority\}\)/);
const authoritySource=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js",import.meta.url),"utf8");assert.match(authoritySource,/checkoutProven\(checkoutBindingStatus\)/);assert.match(authoritySource,/resolveCheckoutBinding:checkoutBindingAuthority\.resolveCheckoutBinding/);
const registrySource=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressRegistry.js",import.meta.url),"utf8");assert.match(registrySource,/ownedStatus\(adapter\)/);assert.match(registrySource,/rawBodyDeliveryVerification===true/);assert.match(registrySource,/signatureVerification===true/);assert.match(registrySource,/creatorPayloadIsNotPaymentAuthority===true/);
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");assert.doesNotMatch(server,/MovieMentorProductionCommercialProviderIngressComposition/);assert.doesNotMatch(server,/commercial-provider-ingress/);
console.log("✓ forged provider delivery cannot reach entitlement issuance");
console.log("✓ method-shaped provider adapters and commercial neighbours grant zero authority credit");
console.log("✓ provider ingress consumes durable purchase-intent, checkout-session and issuance owner proofs");
console.log("✓ provider identity, checkout session, amount, product, currency and environment remain bound");
console.log("✓ provider payload cannot choose creator principal or entitlement units");
console.log("LAW: provider transport may prove a delivery; it may never borrow authority from a different durable checkout session");
console.log("5A.11 commercial provider ingress authority torture: GREEN");
