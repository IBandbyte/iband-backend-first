import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source=await fs.readFile(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const server=await fs.readFile(new URL("../server.js",import.meta.url),"utf8");
assert.match(source,/express\.raw\(\{type:"application\/json",limit:"512kb"\}\)/,"Stripe webhook must preserve raw bytes.");
assert.match(source,/Stripe-Signature/);assert.match(source,/delivery:\{rawBody:req\.body,signature:/);assert.match(source,/createMovieMentorStripeCommercialProviderAdapter/);assert.match(source,/createMovieMentorProductionCommercialProviderIngressComposition/);assert.match(source,/createMovieMentorProductionEntitlementIssuanceComposition/);assert.match(source,/createMovieMentorProductionCreatorCommercialComposition/);assert.doesNotMatch(source,/principalId:req\.body|units:req\.body|amountMinor:req\.body|currency:req\.body/);assert.match(source,/if\(!stripe\|\|!webhookSecret\|\|!successUrl\|\|!cancelUrl\)return closed/);
assert.match(source,/ownedStatus\(ingress\?\.authority\)/,"HTTP mount must consume ingress-authority-owned capability proof.");
assert.match(source,/ingressProven\(ingressStatus\)/,"HTTP mount must require exact ingress provenance before route registration.");
assert.match(source,/s\?\.domain===INGRESS_DOMAIN/);assert.match(source,/purchaseIntentProvenanceRequired===true/);assert.match(source,/issuanceProvenanceRequired===true/);assert.match(source,/processLocalFallback===false/);
assert.match(source,/commercial-provider-ingress-capability-not-proven/);
const proofIndex=source.indexOf("ingressProven(ingressStatus)");const routeIndex=source.indexOf("app.post(STRIPE_WEBHOOK_PATH");assert(proofIndex>=0&&routeIndex>proofIndex,"No provider HTTP route may mount before ingress authority provenance is proven.");
assert.match(server,/await mountMovieMentorProductionCommercialHttpIngress\(\{app,stripe:stripeClient\}\)/);const rawIndex=server.indexOf("mountMovieMentorProductionCommercialHttpIngress");const jsonIndex=server.indexOf("app.use(express.json");const creatorIndex=server.indexOf("app.use(commercialMount.creatorBasePath");assert(rawIndex>=0&&jsonIndex>rawIndex,"Raw provider ingress must compose before JSON parser.");assert(creatorIndex>jsonIndex,"Creator commercial router must mount after JSON and browser-origin middleware.");assert.doesNotMatch(source,/app\.use\(CREATOR_BASE_PATH,creator\.router\)/,"Pre-parser ingress must never mount browser creator routes.");
console.log("PASS 5A.15 regression: raw signed provider ingress remains before JSON while authenticated creator commerce is mounted only after browser-origin/CORS/JSON authority.");
console.log("PASS ROUND SEVEN: production HTTP ingress consumes exact provider-ingress authority provenance before exposing the irreversible webhook boundary.");
console.log("LAW: composition readiness is not HTTP authority; the boundary must consume the authority's own proof before mounting.");
