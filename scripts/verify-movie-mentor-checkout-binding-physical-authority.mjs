import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorCommercialCheckoutBindingMongoStore } from "../ai/MovieMentorCommercialCheckoutBindingMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCommercialCheckoutBindingMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialCheckoutComposition.js",import.meta.url),"utf8");
const ingressSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/mountMovieMentorProductionCommercialHttpIngress/,"production server must mount commercial ingress");
assert.match(ingressSource,/createMovieMentorProductionCommercialCheckoutComposition/,"production commercial ingress must compose checkout authority");
assert.match(compositionSource,/createMovieMentorCommercialCheckoutBindingMongoStore\(\)/,"production checkout composition must instantiate the durable checkout-binding store");
assert.match(storeSource,/schema\.index\(\{commercialIntentId:1\},\{unique:true\}\)/,"checkout binding declares commercialIntentId uniqueness");
assert.match(storeSource,/schema\.index\(\{provider:1,checkoutReference:1\},\{unique:true,partialFilterExpression:/,"checkout binding declares provider checkout-reference uniqueness");
assert.match(storeSource,/schema\.index\(\{provider:1,providerPaymentReference:1\},\{unique:true,partialFilterExpression:/,"checkout binding declares provider payment-reference uniqueness");
assert.match(storeSource,/findOneAndUpdate\([^]*upsert:true/,"checkout begin crosses an irreversible unique-identity-dependent upsert");

let mutations=0;
const wrongPhysicalIndexes=[{name:"_id_",key:{_id:1},unique:true}];
const row={
  domain:"iband.movie-mentor.commercial-checkout-binding",
  schema:1,
  commercialIntentId:"intent-checkout-physical-red",
  provider:"stripe",
  idempotencyKey:"checkout-idempotency-physical-red",
  status:"pending",
  checkoutReference:null,
  checkoutUrl:null,
  expiresAt:null,
  providerPaymentReference:null,
  createdAtAuthority:new Date("2035-01-01T00:00:00.000Z"),
};
const modelRef={
  async init(){return modelRef;},
  collection:{async indexes(){return wrongPhysicalIndexes;}},
  findOneAndUpdate(){
    mutations+=1;
    return {lean(){return this;},async exec(){return row;}};
  },
};
const store=createMovieMentorCommercialCheckoutBindingMongoStore({modelRef,connectStore:async()=>{},now:()=>new Date("2035-01-01T00:00:00.000Z")});

await assert.rejects(
  ()=>store.begin({
    commercialIntentId:"intent-checkout-physical-red",
    provider:"stripe",
    idempotencyKey:"checkout-idempotency-physical-red",
  }),
  error=>error?.code==="MOVIE_MENTOR_CHECKOUT_BINDING_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "model.init success must not lend checkout uniqueness authority when the exact physical unique indexes are absent",
);
assert.equal(mutations,0,"missing physical checkout-binding uniqueness must fail before durable upsert");

console.log("GREEN: checkout binding independently proves all exact physical unique identities before irreversible mutation.");
console.log("LAW: MODEL INITIALIZATION IS NOT OBSERVED CHECKOUT-BINDING PHYSICAL AUTHORITY.");
