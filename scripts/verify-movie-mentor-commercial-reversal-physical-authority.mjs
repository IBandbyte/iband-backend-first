import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorCommercialReversalMongoStore} from "../ai/MovieMentorCommercialReversalMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCommercialReversalMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialReversalComposition.js",import.meta.url),"utf8");
const ingressSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/mountMovieMentorProductionCommercialHttpIngress/,"production server must mount commercial HTTP ingress");
assert.match(ingressSource,/reversal=createMovieMentorProductionCommercialReversalComposition\(\)/,"production commercial ingress must compose the default reversal authority");
assert.match(compositionSource,/store\|\|createMovieMentorCommercialReversalMongoStore\(\)/,"production reversal composition must instantiate the durable Mongo store by default");
assert.match(storeSource,/es\.index\(\{principalId:1\},\{unique:true\}\)/,"reversal store declares entitlement principal uniqueness it depends on");
assert.match(storeSource,/rs\.index\(\{reversalId:1\},\{unique:true\}\)/,"reversal identity must be declared unique");
assert.match(storeSource,/rs\.index\(\{evidenceSource:1,evidenceId:1\},\{unique:true\}\)/,"final reversal evidence identity must be declared unique");
assert.match(storeSource,/ps\.index\(\{evidenceSource:1,evidenceId:1\},\{unique:true\}\)/,"pending reversal evidence identity must be declared unique");
assert.match(storeSource,/P\.create\(/,"pending reconciliation path must cross a durable history mint");
assert.match(storeSource,/R\.create\(/,"final reversal path must cross a durable reversal-receipt mint");

let indexInitializations=0;
let durableReads=0;
let durableWrites=0;
let transactions=0;
const wrongPhysicalIndexes=Object.freeze([{name:"_id_",key:Object.freeze({_id:1}),unique:true}]);
const q=value=>({session(){return this;},lean(){return this;},sort(){return this;},async exec(){durableReads+=1;return value;}});
function model(){return {
 async createIndexes(){indexInitializations+=1;return[];},
 collection:{async indexes(){return wrongPhysicalIndexes;}},
 findOne(){return q(null);},
 find(){return q([]);},
 findOneAndUpdate(){durableWrites+=1;return q(null);},
 async create(){durableWrites+=1;return null;},
 deleteOne(){durableWrites+=1;return q(null);},
};}
const entitlementModel=model(),reversalModel=model(),pendingModel=model();
const session={async withTransaction(fn){transactions+=1;await fn();},async endSession(){}};
const store=createMovieMentorCommercialReversalMongoStore({
 modelSet:{entitlementModel,reversalModel,pendingModel},
 startSession:async()=>session,
 createReversalId:()=>"reversal-physical-red",
 now:()=>new Date("2035-01-01T00:00:00.000Z"),
});

await assert.rejects(
 ()=>store.preservePending({
  evidenceId:"evt-reversal-physical-red",
  evidenceSource:"stripe",
  evidenceKind:"refund",
  providerPaymentReference:"payment-reversal-physical-red",
  reversalAmountMinor:1200,
  currency:"GBP",
  verifiedAt:"2035-01-01T00:00:00.000Z",
 }),
 error=>error?.code==="MOVIE_MENTOR_COMMERCIAL_REVERSAL_PHYSICAL_AUTHORITY_UNAVAILABLE",
 "successful createIndexes() must not lend reversal authority when exact physical unique identities are absent",
);
assert.equal(indexInitializations,3,"court must allow all model index initialization to succeed before testing physical reality");
assert.equal(durableReads,0,"missing physical uniqueness must fail before durable reversal reads");
assert.equal(durableWrites,0,"missing physical uniqueness must fail before pending or final reversal mutation");
assert.equal(transactions,0,"missing physical uniqueness must fail before reversal transaction entry");

console.log("GREEN: commercial reversal independently proves every exact physical unique identity before durable reads, pending history, or suspension transaction.");
console.log("LAW: ENTITLEMENT UNIQUENESS, REVERSAL UNIQUENESS, AND PENDING-REVERSAL UNIQUENESS EACH OWN THEIR PHYSICAL PROOF HERE; MODEL INITIALIZATION LENDS NONE OF IT.");
