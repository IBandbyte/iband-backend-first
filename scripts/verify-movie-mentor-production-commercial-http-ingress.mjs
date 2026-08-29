import assert from "node:assert/strict";
import fs from "node:fs/promises";

const source=await fs.readFile(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const server=await fs.readFile(new URL("../server.js",import.meta.url),"utf8");

assert.match(source,/express\.raw\(\{type:"application\/json",limit:"512kb"\}\)/,"Stripe webhook must preserve raw bytes.");
assert.match(source,/Stripe-Signature/,"Stripe signature header must cross the HTTP boundary.");
assert.match(source,/delivery:\{rawBody:req\.body,signature:/,"Ingress must receive raw body plus signature only.");
assert.match(source,/createMovieMentorStripeCommercialProviderAdapter/,"Production HTTP ingress must explicitly compose the replaceable Stripe adapter.");
assert.match(source,/createMovieMentorProductionCommercialProviderIngressComposition/,"Verified provider delivery must flow through certified provider ingress authority.");
assert.match(source,/createMovieMentorProductionEntitlementIssuanceComposition/,"Commercial evidence must terminate at certified entitlement issuance authority.");
assert.match(source,/createMovieMentorProductionCreatorCommercialComposition/,"Authenticated creator commercial gateway must be explicitly composed.");
assert.doesNotMatch(source,/principalId:req\.body|units:req\.body|amountMinor:req\.body|currency:req\.body/,"Browser payload must not manufacture commercial authority.");
assert.match(source,/if\(!stripe\|\|!webhookSecret\|\|!successUrl\|\|!cancelUrl\)return closed/,"Missing provider configuration must fail closed.");
assert.match(server,/mountMovieMentorProductionCommercialHttpIngress/,"Production server must mount the certified commercial HTTP boundary.");
const rawIndex=server.indexOf("mountMovieMentorProductionCommercialHttpIngress");
const jsonIndex=server.indexOf("app.use(express.json");
assert(rawIndex>=0&&jsonIndex>=0,"Server must contain commercial mount and general JSON parser.");
assert.match(server,/await mountMovieMentorProductionCommercialHttpIngress\(\{app,stripe:stripeClient\}\)/,"Commercial boundary must be mounted explicitly with provider client.");
assert.match(server,/const commercialMount=await mountMovieMentorProductionCommercialHttpIngress/,"Commercial mount outcome must be explicit.");
console.log("PASS 5A.15: raw signed provider HTTP ingress is physically mounted before general JSON parsing; creator checkout remains authenticated; provider delivery cannot manufacture creator/payment authority; missing Stripe configuration fails closed.");
