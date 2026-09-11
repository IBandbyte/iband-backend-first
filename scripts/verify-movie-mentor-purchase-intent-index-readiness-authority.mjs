import assert from "node:assert/strict";
import {createMovieMentorCommercialPurchaseIntentMongoStore} from "../ai/MovieMentorCommercialPurchaseIntentMongoStore.js";

let initialized=false;
let createCalls=0;
const modelRef={
 collection:{async indexes(){return[
  {name:"_id_",key:{_id:1},unique:true},
  {name:"commercialIntentId_1",key:{commercialIntentId:1},unique:true},
  {name:"purchase_attempt_unique",key:{domain:1,schema:1,principalId:1,purchaseAttemptDigest:1},unique:true},
 ];}},
 async init(){initialized=true;return modelRef;},
 async create(records){
  createCalls+=1;
  assert.equal(initialized,true,"durable purchase-attempt uniqueness indexes must be ready before any charge-capable purchase-intent mint");
  return records.map(record=>Object.freeze({...record,_id:"row-1"}));
 }
};

const store=createMovieMentorCommercialPurchaseIntentMongoStore({modelRef,now:()=>new Date("2030-01-01T00:00:00.000Z")});
const record={
 commercialIntentId:"intent-index-ready-1",
 principalId:"creator-index-ready",
 purchaseAttemptDigest:"attempt-digest-index-ready",
 packageId:"creator-20",
 provider:"stripe",
 providerProductId:"price_creator_20",
 amountMinor:2000,
 currency:"GBP",
 environment:"live",
 units:20,
 policyVersion:"index-ready-v1",
 policyDigest:"policy-digest-index-ready"
};

const created=await store.create(record);
assert.equal(createCalls,1,"court must cross the durable mint boundary exactly once");
assert.equal(initialized,true,"store readiness must include model/index readiness, not merely database connectivity");
assert.equal(created.commercialIntentId,record.commercialIntentId);
assert.equal(created.purchaseAttemptDigest,record.purchaseAttemptDigest);
console.log("purchase-intent index-readiness authority torture: GREEN");
console.log("LAW: A UNIQUE INDEX IS COMMERCIAL AUTHORITY ONLY AFTER ITS READINESS IS PROVEN; DATABASE CONNECTIVITY ALONE MUST NOT OPEN THE PURCHASE-INTENT MINT BOUNDARY.");
