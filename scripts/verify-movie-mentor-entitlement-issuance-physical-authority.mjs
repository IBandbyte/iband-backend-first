import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorEntitlementIssuanceMongoStore} from "../ai/MovieMentorEntitlementIssuanceMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorEntitlementIssuanceMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionEntitlementIssuanceComposition.js",import.meta.url),"utf8");
const ingressSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/mountMovieMentorProductionCommercialHttpIngress/,"production server must mount commercial HTTP ingress");
assert.match(ingressSource,/issuance=createMovieMentorProductionEntitlementIssuanceComposition\(\)/,"production commercial ingress must compose the default durable entitlement-issuance authority");
assert.match(compositionSource,/store\|\|createMovieMentorEntitlementIssuanceMongoStore\(\)/,"production entitlement composition must instantiate the Mongo store by default");
assert.match(storeSource,/es\.index\(\{principalId:1\},\{unique:true\}\)/,"entitlement principal identity must be declared unique");
assert.match(storeSource,/is\.index\(\{issuanceId:1\},\{unique:true\}\)/,"issuance identity must be declared unique");
assert.match(storeSource,/is\.index\(\{evidenceSource:1,evidenceId:1\},\{unique:true\}\)/,"provider evidence identity must be declared unique");
assert.match(storeSource,/E\.create\(/,"issuance path must cross the durable entitlement mint boundary");
assert.match(storeSource,/I\.create\(/,"issuance path must cross the durable issuance-receipt mint boundary");

let indexInitializations=0;
let entitlementCreates=0;
let issuanceCreates=0;
let transactions=0;
const wrongPhysicalIndexes=Object.freeze([{name:"_id_",key:Object.freeze({_id:1}),unique:true}]);
const chain=value=>({session(){return this;},lean(){return this;},async exec(){return value;}});
const entitlementModel={
 async createIndexes(){indexInitializations+=1;return[];},
 collection:{async indexes(){return wrongPhysicalIndexes;}},
 findOne(){return chain(null);},
 async create(rows){
  entitlementCreates+=1;
  return [{...rows[0],entitlementRevision:1}];
 },
};
const issuanceModel={
 async createIndexes(){indexInitializations+=1;return[];},
 collection:{async indexes(){return wrongPhysicalIndexes;}},
 findOne(){return chain(null);},
 async create(rows){issuanceCreates+=1;return rows;},
};
const session={
 async withTransaction(fn){transactions+=1;await fn();},
 async endSession(){},
};
const store=createMovieMentorEntitlementIssuanceMongoStore({
 modelSet:{entitlementModel,issuanceModel},
 startSession:async()=>session,
 createIssuanceId:()=>"issuance-physical-red",
 now:()=>new Date("2035-01-01T00:00:00.000Z"),
});

await assert.rejects(
 ()=>store.issue({
  evidenceId:"evt-entitlement-physical-red",
  evidenceSource:"stripe",
  evidenceKind:"payment-completed",
  evidenceDigest:"digest-entitlement-physical-red",
  principalId:"creator-entitlement-physical-red",
  units:20,
  commercialReference:"intent-entitlement-physical-red",
 }),
 error=>error?.code==="MOVIE_MENTOR_ENTITLEMENT_ISSUANCE_PHYSICAL_AUTHORITY_UNAVAILABLE",
 "successful createIndexes() must not lend entitlement or issuance uniqueness authority when the exact physical Mongo indexes are absent",
);
assert.equal(indexInitializations,2,"court must allow model/index initialization to succeed before testing observed physical reality");
assert.equal(transactions,0,"missing physical uniqueness must fail before the issuance transaction begins");
assert.equal(entitlementCreates,0,"missing physical uniqueness must fail before entitlement mint");
assert.equal(issuanceCreates,0,"missing physical uniqueness must fail before issuance receipt mint");

console.log("GREEN: entitlement issuance independently proves each collection's exact physical unique identities before transaction entry.");
console.log("LAW: MODEL INDEX INITIALIZATION IS NOT OBSERVED ENTITLEMENT-ISSUANCE PHYSICAL AUTHORITY.");
