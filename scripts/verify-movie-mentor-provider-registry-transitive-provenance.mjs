import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createMovieMentorCommercialProviderIngressRegistry} from "../ai/MovieMentorCommercialProviderIngressRegistry.js";
import {createMovieMentorCommercialProviderIngressAuthority} from "../ai/MovieMentorCommercialProviderIngressAuthority.js";
import {createMovieMentorProductionCommercialProviderIngressComposition} from "../ai/MovieMentorProductionCommercialProviderIngressComposition.js";

const ADAPTER_DOMAIN="iband.movie-mentor.commercial-provider-adapter";
const REGISTRY_DOMAIN="iband.movie-mentor.commercial-provider-ingress-registry";
const INGRESS_DOMAIN="iband.movie-mentor.commercial-provider-ingress-authority";
const PURCHASE_DOMAIN="iband.movie-mentor.production-commercial-purchase-intent-authority";
const ISSUANCE_DOMAIN="iband.movie-mentor.production-entitlement-issuance-authority";

const adapterStatus=Object.freeze({domain:ADAPTER_DOMAIN,provider:"provider-a",productionCommercialProviderAdapter:true,checkoutTransport:true,serverOwnedIdempotencyRequired:true,rawBodyDeliveryVerification:true,signatureVerification:true,normalizesCommercialEvidence:true,creatorPayloadIsNotPaymentAuthority:true,processLocalFallback:false});
const adapter=Object.freeze({verifyDelivery:async({delivery})=>Object.freeze({verified:true,payload:delivery}),normalizeEvent:async({verifiedDelivery})=>verifiedDelivery.payload,getStatus:()=>adapterStatus});
const purchaseStatus=Object.freeze({domain:PURCHASE_DOMAIN,production:true,durablePurchaseIntent:true,immutableCommercialTerms:true,serverOwnedPolicy:true,processLocalFallback:false});
const issuanceStatus=Object.freeze({domain:ISSUANCE_DOMAIN,production:true,durableAtomicIssuance:true,evidenceIdentityUnique:true,issuanceReceiptDurable:true,processLocalFallback:false});
const purchase=Object.freeze({resolvePurchaseIntent:async()=>null,getStatus:()=>purchaseStatus});
const issuance=Object.freeze({issueVerifiedEvidence:async()=>Object.freeze({authorized:true}),getStatus:()=>issuanceStatus});

const registry=createMovieMentorCommercialProviderIngressRegistry({providers:{"provider-a":adapter}});
const registryStatus=registry.getStatus();
assert.equal(registryStatus.domain,REGISTRY_DOMAIN);
assert.equal(registryStatus.providerAdapterProvenanceRequired,true);
assert.equal(registryStatus.rawBodyDeliveryVerificationRequired,true);
assert.equal(registryStatus.signatureVerificationRequired,true);
assert.equal(registryStatus.evidenceNormalizationRequired,true);
assert.equal(registryStatus.creatorPayloadIsNotPaymentAuthority,true);
assert.equal(registryStatus.processLocalFallback,false);
assert.deepEqual(registryStatus.configuredProviders,["provider-a"]);
assert.equal(registryStatus.providerStatuses["provider-a"],adapterStatus,"registry proof must preserve the exact adapter-owned proof it consumed");
assert.throws(()=>createMovieMentorCommercialProviderIngressRegistry({providers:{"provider-a":{verifyDelivery:adapter.verifyDelivery,normalizeEvent:adapter.normalizeEvent}}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");
assert.throws(()=>createMovieMentorCommercialProviderIngressRegistry({providers:{"provider-a":{...adapter,getStatus:()=>({...adapterStatus,signatureVerification:false})}}}),error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_PROVIDER_INGRESS_INVALID");

const authority=createMovieMentorCommercialProviderIngressAuthority({providers:{"provider-a":adapter},purchaseIntentAuthority:purchase,issuanceAuthority:issuance});
const authorityStatus=authority.getStatus();
assert.equal(authorityStatus.domain,INGRESS_DOMAIN);
assert.equal(authorityStatus.providerRegistryProvenanceRequired,true);
assert.equal(authorityStatus.providerRegistryStatus.domain,REGISTRY_DOMAIN);
assert.equal(authorityStatus.providerRegistryStatus.providerStatuses["provider-a"],adapterStatus);
assert.equal(authorityStatus.processLocalFallback,false);

const composition=createMovieMentorProductionCommercialProviderIngressComposition({providers:{"provider-a":adapter},purchaseIntentAuthority:purchase,issuanceAuthority:issuance});
assert.equal(composition.ready,true);
assert.equal(composition.authorityStatus,composition.authority.getStatus(),"composition must expose the exact stable authority-owned proof object rather than manufacture a replacement");
assert.equal(composition.providerRegistryStatus,composition.authorityStatus.providerRegistryStatus);

const httpSource=await fs.readFile(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
assert.match(httpSource,/providerRegistryProvenanceRequired===true/);
assert.match(httpSource,/registryProven\(status\?\.providerRegistryStatus\)/);
assert.match(httpSource,/status\?\.domain===REGISTRY_DOMAIN/);
assert.match(httpSource,/providerAdapterProvenanceRequired===true/);
assert.match(httpSource,/rawBodyDeliveryVerificationRequired===true/);
assert.match(httpSource,/signatureVerificationRequired===true/);
assert.match(httpSource,/evidenceNormalizationRequired===true/);
const proofIndex=httpSource.indexOf("ingressProven(ingressStatus)");
const routeIndex=httpSource.indexOf("app.post(STRIPE_WEBHOOK_PATH");
assert(proofIndex>=0&&routeIndex>proofIndex,"HTTP webhook exposure must remain downstream of transitive provider-registry provenance proof");

console.log("✓ provider adapter owns raw-body/signature/normalization capability proof");
console.log("✓ ingress registry owns and preserves exact provider-adapter provenance");
console.log("✓ ingress authority consumes and preserves registry-owned provenance");
console.log("✓ production composition exposes owner proof without manufacturing replacement credit");
console.log("✓ HTTP boundary requires transitive registry provenance before webhook exposure");
console.log("LAW: ADAPTER PROOF → REGISTRY PROOF → INGRESS AUTHORITY → HTTP ROUTE. PROOF DOES NOT TELEPORT.");
console.log("ROUND SEVEN provider-registry transitive provenance torture: GREEN");
