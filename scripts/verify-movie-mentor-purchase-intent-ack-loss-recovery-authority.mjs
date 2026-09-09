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
let ids=0;
const authority=createMovieMentorCommercialPurchaseIntentAuthority({
 store,
 resolveCommercialPolicy:async({packageId})=>Object.freeze({packageId,provider:"provider-a",providerProductId:"prod_creator20",amountMinor:1200,currency:"GBP",environment:"live",units:20,policyVersion:"v1"}),
 createCommercialIntentId:()=>`intent_ack_loss_${++ids}`
});
const input={principalId:"creator-ack-loss",packageId:"creator-20",currentPrincipalAuthority:async()=>({principalId:"creator-ack-loss"})};
await assert.rejects(()=>authority.createPurchaseIntent(input),error=>error?.code==="MOVIE_MENTOR_PURCHASE_INTENT_AUTHORITY_UNAVAILABLE");
const recovered=await authority.createPurchaseIntent(input);
assert.equal(rows.size,1,"retry after a committed-but-unacknowledged purchase-intent mint must not create a second charge-capable durable intent");
assert.equal(recovered.commercialIntentId,"intent_ack_loss_1","retry must recover the exact durable commercial authority whose ACK was lost");
assert.equal(createCalls,1,"recovery must not cross a second irreversible durable mint");
console.log("purchase-intent ACK-loss recovery authority torture: GREEN");
console.log("LAW: A LOST DURABLE PURCHASE-INTENT MINT ACK MAY HIDE COMMITTED COMMERCIAL AUTHORITY; RETRY MUST RECOVER EXACT DURABLE REALITY BEFORE MINTING A SECOND CHARGE-CAPABLE INTENT.");
