import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

function digest(value){return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");}
async function rejects(code,fn){await assert.rejects(fn,error=>error?.code===code);}
const purchaseCapability=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const issuanceCapability=Object.freeze({domain:"iband.movie-mentor.production-entitlement-issuance-authority",production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false});
const providerCapability=Object.freeze({domain:"iband.movie-mentor.commercial-provider-adapter",provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});

const snapshot=Object.freeze({packageId:"creator-20",provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
const intent=Object.freeze({commercialIntentId:"intent_1",principalId:"principal_A",...snapshot,policyDigest:digest(snapshot),status:"created"});
const baseEvent=Object.freeze({eventId:"evt_1",provider:"provider-a",eventKind:"payment-completed",commercialIntentId:"intent_1",commerciallyFinal:true,providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live"});

let issuanceCalls=0;
let lastEvidence=null;
const issuanceAuthority={async issueVerifiedEvidence({evidence}){issuanceCalls++;lastEvidence=evidence;return Object.freeze({authorized:true,evidenceId:evidence.evidenceId,principalId:evidence.principalId,units:evidence.units});}};
const provenPurchase=Object.freeze({resolvePurchaseIntent:async({commercialIntentId})=>commercialIntentId===intent.commercialIntentId?intent:null,getStatus:()=>purchaseCapability});
const provenIssuance=Object.freeze({issueVerifiedEvidence:issuanceAuthority.issueVerifiedEvidence,getStatus:()=>issuanceCapability});
const providerA={
  async verifyDelivery({delivery}){return delivery?.signature==="provider-a-valid"?Object.freeze({verified:true,payload:delivery.payload}):Object.freeze({verified:false});},
  async normalizeEvent({verifiedDelivery}){return verifiedDelivery.payload;},
  getStatus(){return providerCapability;},
};

assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},purchaseIntentAuthority:{resolvePurchaseIntent:provenPurchase.resolvePurchaseIntent},issuanceAuthority:provenIssuance}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},purchaseIntentAuthority:provenPurchase,issuanceAuthority:{issueVerifiedEvidence:provenIssuance.issueVerifiedEvidence}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},purchaseIntentAuthority:{...provenPurchase,getStatus:()=>({...purchaseCapability,immutableCommercialTerms:false})},issuanceAuthority:provenIssuance}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},purchaseIntentAuthority:provenPurchase,issuanceAuthority:{...provenIssuance,getStatus(){throw new Error("uncertain");}}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");

const authority=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":providerA},purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance});
assert.equal(authority.getStatus().purchaseIntentProvenanceRequired,true);
assert.equal(authority.getStatus().issuanceProvenanceRequired,true);
assert.equal(authority.getStatus().processLocalFallback,false);
assert.equal(authority.ingest,authority.processProviderDelivery,"HTTP ingress alias must preserve the same certified authority function");

await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_DELIVERY_UNVERIFIED",()=>authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"forged",payload:baseEvent}}));
assert.equal(issuanceCalls,0,"forged provider delivery must cause zero issuance");
await rejects("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED",()=>authority.processProviderDelivery({provider:"provider-b",delivery:{signature:"provider-a-valid",payload:baseEvent}}));
assert.equal(issuanceCalls,0,"unconfigured provider must cause zero issuance");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":{verifyDelivery:providerA.verifyDelivery,normalizeEvent:providerA.normalizeEvent}},purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
assert.throws(()=>createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":{...providerA,getStatus:()=>({...providerCapability,signatureVerification:false})}},purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
const mismatched=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":{verifyDelivery:providerA.verifyDelivery,normalizeEvent:async({verifiedDelivery})=>({...verifiedDelivery.payload,provider:"provider-b"}),getStatus:()=>providerCapability}},purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance});
await rejects("MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PROVIDER_MISMATCH",()=>mismatched.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:baseEvent}}));
assert.equal(issuanceCalls,0,"provider-route identity mismatch must cause zero issuance");
await rejects("MOVIE_MENTOR_COMMERCIAL_EVIDENCE_AMOUNT_MISMATCH",()=>authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:{...baseEvent,amountMinor:1}}}));
assert.equal(issuanceCalls,0,"commercial mismatch must cause zero issuance");
const result=await authority.processProviderDelivery({provider:"provider-a",delivery:{signature:"provider-a-valid",payload:{...baseEvent,principalId:"attacker",units:999999}}});
assert.equal(result.authorized,true);assert.equal(result.principalId,"principal_A");assert.equal(result.units,20);assert.equal(issuanceCalls,1);assert.equal(lastEvidence.principalId,"principal_A");assert.equal(lastEvidence.units,20);assert.equal(lastEvidence.evidenceId,"evt_1");

assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:{resolvePurchaseIntent:async()=>intent},issuanceAuthority:provenIssuance,providers:{"provider-a":providerA}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:provenPurchase,issuanceAuthority:{issueVerifiedEvidence:issuanceAuthority.issueVerifiedEvidence},providers:{"provider-a":providerA}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:{...provenPurchase,getStatus:()=>({...purchaseCapability,durablePurchaseIntent:false})},issuanceAuthority:provenIssuance,providers:{"provider-a":providerA}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:provenPurchase,issuanceAuthority:{...provenIssuance,getStatus(){throw new Error("uncertain");}},providers:{"provider-a":providerA}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_ISSUANCE_REQUIRED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance,providers:{}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_NOT_CONFIGURED");
assert.throws(()=>createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance,providers:{"provider-a":{verifyDelivery:providerA.verifyDelivery,normalizeEvent:providerA.normalizeEvent}}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
const production=createMovieMentorProductionCommercialProviderIngressComposition({purchaseIntentAuthority:provenPurchase,issuanceAuthority:provenIssuance,providers:{"provider-a":providerA}});assert.equal(production.ready,true);assert.deepEqual(production.configuredProviders,["provider-a"]);assert.equal(production.publicRoute,false);assert.equal(production.rawBodyBoundaryRequired,true);

const source=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialProviderIngressComposition.js",import.meta.url),"utf8");
assert.match(source,/ownedStatus\(purchaseIntentAuthority\)/);assert.match(source,/ownedStatus\(issuanceAuthority\)/);assert.match(source,/purchaseIntentProvenanceRequired:true/);assert.match(source,/issuanceProvenanceRequired:true/);
assert.match(source,/createMovieMentorCommercialProviderIngressAuthority\(\{providers,purchaseIntentAuthority,issuanceAuthority\}\)/);
const authoritySource=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js",import.meta.url),"utf8");
assert.match(authoritySource,/ownedStatus\(purchaseIntentAuthority\)/);assert.match(authoritySource,/ownedStatus\(issuanceAuthority\)/);assert.match(authoritySource,/purchaseIntentProven\(purchaseIntentStatus\)/);assert.match(authoritySource,/issuanceProven\(issuanceStatus\)/);assert.doesNotMatch(authoritySource,/resolvePurchaseIntent\s*,\s*issuanceAuthority/);
const registrySource=fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressRegistry.js",import.meta.url),"utf8");assert.match(registrySource,/ownedStatus\(adapter\)/);assert.match(registrySource,/rawBodyDeliveryVerification===true/);assert.match(registrySource,/signatureVerification===true/);assert.match(registrySource,/creatorPayloadIsNotPaymentAuthority===true/);
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
assert.doesNotMatch(server,/MovieMentorProductionCommercialProviderIngressComposition/);
assert.doesNotMatch(server,/commercial-provider-ingress/);

console.log("✓ forged provider delivery cannot reach entitlement issuance");
console.log("✓ method-shaped provider adapters grant zero ingress transport credit");
console.log("✓ ingress registry consumes adapter-owned raw-body signature verification + normalization proof");
console.log("✓ direct ingress authority consumes purchase-intent and issuance owner proof rather than method shape");
console.log("✓ unconfigured providers fail closed before evidence authority");
console.log("✓ provider identity cannot change during normalization");
console.log("✓ amount/product/currency/environment remain bound to immutable purchase-intent terms");
console.log("✓ provider payload cannot choose creator principal or entitlement units");
console.log("✓ method-shaped purchase or issuance neighbours grant zero production ingress credit");
console.log("✓ incomplete or uncertain neighbouring capability provenance fails closed");
console.log("✓ verified final evidence alone crosses the sealed 5A.7 → 5A.6 bridge");
console.log("✓ provider ingress remains internal until a raw-body-safe production HTTP boundary is explicitly certified");
console.log("LAW: provider transport may prove a delivery; it may never become Movie Mentor commercial authority, and transport methods are not capability proofs");
console.log("LAW: cross-boundary provenance must survive composition intact; a validated neighbour may not be collapsed back to method shape");
console.log("5A.11 commercial provider ingress authority torture: GREEN");
