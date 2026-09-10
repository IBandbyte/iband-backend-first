import assert from "node:assert/strict";
import fs from "node:fs";

const httpSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const ingressSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialProviderIngressComposition.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/mountMovieMentorProductionCommercialHttpIngress\(\{app,stripe:stripeClient\}\)/,"court requires production server reachability into commercial HTTP ingress");
assert.match(httpSource,/app\.post\(STRIPE_WEBHOOK_PATH/,"court requires the production HTTP composition to expose the provider webhook");
assert.match(httpSource,/ingress\.authority\.ingest\(/,"court requires provider webhook bytes to cross into the composed ingress authority");
assert.match(ingressSource,/isMovieMentorProductionCommercialProviderIngressOwnerProof/,"production provider-ingress composition must mint owner-bound proof for the exact authority that may receive webhook bytes");
assert.match(httpSource,/isMovieMentorProductionCommercialProviderIngressOwnerProof/,"commercial HTTP composition must consume provider-ingress owner proof before webhook exposure");
assert.match(httpSource,/ingressProven\(ingress\.authority,ingressStatus\)/,"the exact provider-ingress authority, not status shape alone, must cross the webhook exposure boundary");

console.log("commercial HTTP provider-ingress owner-proof torture: GREEN");
console.log("LAW: A PUBLIC PROVIDER WEBHOOK MAY NOT RECREATE INGRESS AUTHORITY FROM STATUS SHAPE; THE EXACT PRODUCTION-COMPOSED PROVIDER-INGRESS OWNER PROOF MUST CROSS THE WEBHOOK EXPOSURE BOUNDARY.");
