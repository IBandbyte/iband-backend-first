import assert from "node:assert/strict";
import {createMovieMentorCommercialPurchaseIntentAuthority} from "../ai/MovieMentorCommercialPurchaseIntentAuthority.js";

const rows=new Map();
let createCalls=0;
const store={
 async create(record){
  createCalls+=1;
  const durable=Object.freeze({...record,status:"created",createdAt:"2030-01-01T00:00:00.000Z"});
  rows.set(record.commercialIntentId,durable);
  if(createCalls===1){const error=new Error("simulated Mongo ACK loss after durable commit");error.code="MOVIE_MENTOR_PURCHASE_INTENT_AUTHORITY_UNAVAILABLE";error.retryable=true;throw error;}
  return durable;
 },
 async resolve({commercialIntentId}){return rows.get(commercialIntentId)||null;}
};
const policy=async({packageId})=>Object.freeze({packageId,provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"});
let ids=0;
const buildAuthority=()=>createMovieMentorCommercialPurchaseIntentAuthority({store,resolveCommercialPolicy:policy,createCommercialIntentId:()=>`intent_restart_${++ids}`});
const input={principalId:"creator-restart",packageId:"creator-20",currentPrincipalAuthority:async()=>({principalId:"creator-restart"})};
const beforeRestart=buildAuthority();
await assert.rejects(()=>beforeRestart.createPurchaseIntent(input),error=>error?.code==="MOVIE_MENTOR_PURCHASE_INTENT_AUTHORITY_UNAVAILABLE");
// Process death: all in-memory correlation owned by the first authority instance is gone.
const afterRestart=buildAuthority();
const recovered=await afterRestart.createPurchaseIntent(input);
assert.equal(rows.size,1,"retry after committed ACK loss plus process restart must not mint a second charge-capable purchase intent");
assert.equal(recovered.commercialIntentId,"intent_restart_1","restart recovery must rediscover the exact durable commercial authority whose ACK was lost");
assert.equal(createCalls,1,"restart recovery must not cross a second irreversible durable mint");
console.log("purchase-intent ACK-loss process-restart recovery authority torture: GREEN");
console.log("LAW: ACK-LOSS RECOVERY AUTHORITY MUST SURVIVE PROCESS DEATH; DURABLE COMMERCIAL REALITY, NOT PROCESS MEMORY, MUST IDENTIFY THE COMMITTED PURCHASE INTENT BEFORE ANY SECOND MINT.");
