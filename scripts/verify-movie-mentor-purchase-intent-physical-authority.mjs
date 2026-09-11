import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorCommercialPurchaseIntentMongoStore } from "../ai/MovieMentorCommercialPurchaseIntentMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCommercialPurchaseIntentMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialPurchaseIntentComposition.js",import.meta.url),"utf8");
const ingressSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/mountMovieMentorProductionCommercialHttpIngress/,"production server must mount commercial ingress");
assert.match(ingressSource,/createMovieMentorProductionCommercialPurchaseIntentComposition/,"production commercial ingress must compose purchase-intent authority");
assert.match(compositionSource,/createMovieMentorCommercialPurchaseIntentMongoStore\(\)/,"production purchase-intent composition must instantiate the durable Mongo store");
assert.match(storeSource,/schema\.index\(\{commercialIntentId:1\},\{unique:true\}\)/,"purchase-intent store declares commercialIntentId uniqueness");
assert.match(storeSource,/schema\.index\(\{domain:1,schema:1,principalId:1,purchaseAttemptDigest:1\},\{unique:true\}\)/,"purchase-intent store declares durable purchase-attempt uniqueness");
assert.match(storeSource,/M\(\)\.create/,"purchase-intent creation crosses an irreversible durable mint");

let creates=0;
const wrongPhysicalIndexes=[{name:"_id_",key:{_id:1},unique:true}];
const modelRef={
  async init(){return modelRef;},
  collection:{async indexes(){return wrongPhysicalIndexes;}},
  async create(rows){creates+=1;return rows;},
};
const store=createMovieMentorCommercialPurchaseIntentMongoStore({modelRef,connectStore:async()=>{},now:()=>new Date("2035-01-01T00:00:00.000Z")});

await assert.rejects(
  ()=>store.create({
    commercialIntentId:"intent-physical-red",
    principalId:"creator-physical-red",
    purchaseAttemptDigest:"attempt-digest-physical-red",
    packageId:"creator-20",
    provider:"stripe",
    providerProductId:"price-physical-red",
    amountMinor:1200,
    currency:"GBP",
    environment:"live",
    units:20,
    policyVersion:"v1",
    policyDigest:"policy-physical-red",
  }),
  error=>error?.code==="MOVIE_MENTOR_PURCHASE_INTENT_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "model.init success must not lend physical uniqueness authority when the actual required unique indexes are absent",
);
assert.equal(creates,0,"missing physical purchase-intent uniqueness must fail before durable mint");

console.log("GREEN: purchase-intent mint independently proves exact physical uniqueness before irreversible durable create.");
console.log("LAW: MODEL INITIALIZATION IS NOT A SUBSTITUTE FOR OBSERVED PHYSICAL UNIQUE-INDEX AUTHORITY.");
