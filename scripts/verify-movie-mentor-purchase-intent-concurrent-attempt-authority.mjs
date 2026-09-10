import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "../ai/MovieMentorCommercialPurchaseIntentAuthority.js";

const rows=new Map();
let createCalls=0;
let ids=0;
let bothReachedCreateResolve;
const bothAtCreateResolve=new Promise(resolve=>{bothReachedCreateResolve=resolve;});
let resolveAtCreateCount=0;

function attemptDigest(principalId,purchaseAttemptId){return crypto.createHash("sha256").update(JSON.stringify({principalId,purchaseAttemptId})).digest("hex");}

const store={
 async resolve(){return null;},
 async resolveAttempt({principalId,purchaseAttemptDigest}){
  const found=[...rows.values()].find(row=>row.principalId===principalId&&row.purchaseAttemptDigest===purchaseAttemptDigest);
  if(found)return found;
  resolveAtCreateCount+=1;
  if(resolveAtCreateCount===2)bothReachedCreateResolve();
  await bothAtCreateResolve;
  return null;
 },
 async create(record){
  createCalls+=1;
  const existing=[...rows.values()].find(row=>row.principalId===record.principalId&&row.purchaseAttemptDigest===record.purchaseAttemptDigest);
  if(existing){const error=new Error("duplicate durable purchase attempt");error.code="MOVIE_MENTOR_PURCHASE_INTENT_ID_CONFLICT";error.retryable=true;throw error;}
  const durable=Object.freeze({...record,status:"created",createdAt:new Date().toISOString()});
  rows.set(record.commercialIntentId,durable);
  return durable;
 }
};

const authority=createMovieMentorCommercialPurchaseIntentAuthority({
 store,
 resolveCommercialPolicy:async({packageId})=>({packageId,provider:"stripe",providerProductId:"price_creator_20",amountMinor:2000,currency:"GBP",environment:"test",units:20,policyVersion:"concurrent-attempt-v1"}),
 createCommercialIntentId:()=>`intent_concurrent_${++ids}`
});

const input={principalId:"creator-concurrent",packageId:"creator-20",purchaseAttemptId:"attempt-concurrent-1",currentPrincipalAuthority:async()=>({principalId:"creator-concurrent"})};
const expectedAttemptDigest=attemptDigest(input.principalId,input.purchaseAttemptId);
const [first,second]=await Promise.all([authority.createPurchaseIntent(input),authority.createPurchaseIntent(input)]);

assert.equal(rows.size,1,"two concurrent requests for one stable purchaseAttemptId must produce exactly one durable charge-capable purchase intent");
assert.equal(first.commercialIntentId,second.commercialIntentId,"both concurrent callers must converge on the exact same durable purchase intent");
assert.equal(first.purchaseAttemptDigest,expectedAttemptDigest,"durable winner must preserve the stable purchase-attempt identity");
assert.equal(second.purchaseAttemptDigest,expectedAttemptDigest,"concurrent loser recovery must preserve the same purchase-attempt identity");
assert.equal(createCalls,2,"court must force both requests past pre-create recovery so the durable uniqueness race is genuinely exercised");
console.log("purchase-intent concurrent-attempt authority torture: GREEN");
console.log("LAW: CONCURRENT REQUESTS FOR ONE STABLE PURCHASE ATTEMPT MAY RACE BEFORE DURABLE VISIBILITY, BUT DURABLE UNIQUENESS MUST ELECT ONE INTENT AND EVERY LOSER MUST RECOVER THAT EXACT COMMERCIAL REALITY.");
