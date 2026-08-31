import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createMovieMentorProductionCreatorCommercialComposition} from "../ai/MovieMentorProductionCreatorCommercialComposition.js";

const AUTH_DOMAIN="iband.movie-mentor.production-authentication-composition";
const CREATOR_DOMAIN="iband.movie-mentor.production-creator-commercial-composition";
const purchaseProof=Object.freeze({domain:"iband.movie-mentor.production-commercial-purchase-intent-authority",production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const checkoutProof=Object.freeze({domain:"iband.movie-mentor.production-commercial-checkout-authority",production:true,durableCheckoutBinding:true,serverOwnedIdempotency:true,purchaseIntentProvenanceRequired:true,explicitProviderRequired:true,processLocalFallback:false});
const catalogueProof=Object.freeze({domain:"iband.movie-mentor.production-commercial-package-catalogue-authority",production:true,serverOwned:true,creatorMutable:false,immutableSnapshotRequired:true,configurationSource:"MOVIE_MENTOR_COMMERCIAL_POLICY_JSON"});
const authentication=Object.freeze({ready:true,domain:AUTH_DOMAIN,provider:"clerk",verifyCredential:async()=>({verified:true}),expectedIssuer:"issuer",expectedAudience:"audience",verifierVersion:"1.0.0",verifierDomain:"iband.movie-mentor.journey-recovery-clerk-credential-verifier"});
const purchaseIntentAuthority=Object.freeze({async createPurchaseIntent(){return Object.freeze({commercialIntentId:"intent-1"});},getStatus(){return purchaseProof;}});
const checkoutAuthority=Object.freeze({async initiateCheckout(){return Object.freeze({authorized:true});},getStatus(){return checkoutProof;}});
const packageCatalogueAuthority=Object.freeze({async listCommercialPackages(){return Object.freeze([]);},getStatus(){return catalogueProof;}});

const composition=createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority,checkoutAuthority,packageCatalogueAuthority});
assert.equal(composition.ready,true);
assert.equal(typeof composition.getStatus,"function","Creator commercial composition must own runtime capability proof.");
const status=composition.getStatus();
assert.equal(status,composition.getStatus(),"Owner proof must be one stable runtime capability object.");
assert.equal(status.domain,CREATOR_DOMAIN);assert.equal(status.production,true);assert.equal(status.authenticationProvenanceRequired,true);assert.equal(status.authenticationDomain,AUTH_DOMAIN);assert.equal(status.purchaseIntentProvenanceRequired,true);assert.equal(status.checkoutProvenanceRequired,true);assert.equal(status.packageCatalogueProvenanceRequired,true);assert.equal(status.publicRouteCandidate,true);assert.equal(status.processLocalFallback,false);
assert.equal(status.purchaseIntentStatus,purchaseProof,"Purchase proof must cross by owner-preserved reference.");
assert.equal(status.checkoutStatus,checkoutProof,"Checkout proof must cross by owner-preserved reference.");
assert.equal(status.catalogueStatus,catalogueProof,"Catalogue proof must cross by owner-preserved reference.");

assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority:{createPurchaseIntent:purchaseIntentAuthority.createPurchaseIntent},checkoutAuthority,packageCatalogueAuthority}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PURCHASE_INTENT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority,checkoutAuthority:{initiateCheckout:checkoutAuthority.initiateCheckout},packageCatalogueAuthority}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_CHECKOUT_REQUIRED");
assert.throws(()=>createMovieMentorProductionCreatorCommercialComposition({authentication,purchaseIntentAuthority,checkoutAuthority,packageCatalogueAuthority:{listCommercialPackages:packageCatalogueAuthority.listCommercialPackages}}),e=>e.code==="MOVIE_MENTOR_CREATOR_COMMERCIAL_PACKAGE_CATALOGUE_REQUIRED");

const http=await fs.readFile(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
assert.match(http,/const creatorStatus=ownedStatus\(creator\)/,"HTTP boundary must consume creator-composition-owned proof.");
assert.match(http,/creatorProven\(creatorStatus\)/,"HTTP boundary must prove creator commercial provenance.");
assert.match(http,/creator-commercial-capability-not-proven/);
assert.match(http,/s\?\.domain===CREATOR_DOMAIN/);assert.match(http,/purchaseProven\(s\?\.purchaseIntentStatus\)/);assert.match(http,/checkoutProven\(s\?\.checkoutStatus\)/);assert.match(http,/catalogueProven\(s\?\.catalogueStatus\)/);
const proofIndex=http.indexOf("creatorProven(creatorStatus)");
const routeExposureIndex=http.indexOf("creatorRouter:creator.router");
assert(proofIndex>=0&&routeExposureIndex>proofIndex,"Creator router must never cross the HTTP mount boundary before owner provenance is proven.");
console.log("PASS ROUND SEVEN: creator commercial composition owns the proof earned from authentication, purchase, checkout and catalogue authorities.");
console.log("PASS ROUND SEVEN: HTTP consumes that exact owner proof before exposing the creator commercial router.");
console.log("LAW: ready:true and publicRouteCandidate:true are not HTTP authority. PROOF DOES NOT TELEPORT.");
