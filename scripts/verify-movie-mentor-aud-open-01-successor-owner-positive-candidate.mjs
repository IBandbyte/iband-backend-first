import assert from "node:assert/strict";
import mongoose from "mongoose";

// AUD-OPEN-01 verifier-only positive successor-owner fixture.
// Proves a current successor can settle NEW pending evidence, while old
// evidence remains idempotent. Does NOT certify the production recovery API.
const uri=process.env.MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated audit MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const owners=db.collection("aud_open_01_successor_owner");
 const ledger=db.collection("aud_open_01_successor_ledger");
 const key="completed-chargeback",payment="pi-successor";
 await owners.insertOne({_id:key,owner:"A",generation:1,leaseUntil:new Date("2999-01-01"),writerFenceRevision:0});
 await ledger.insertOne({_id:payment,remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 async function settle(owner,generation,event,amount){
  const session=await mongoose.startSession();
  try {
   return await session.withTransaction(async()=>{
    const fence=await owners.updateOne({_id:key,owner,generation,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$inc:{writerFenceRevision:1}},{session});
    if(fence.matchedCount!==1){const error=new Error("stale owner");error.code="AUD_OWNER_FENCED";throw error;}
    const updated=await ledger.updateOne({_id:payment,remainingAmountMinor:{$gte:amount},events:{$not:{$elemMatch:{reference:event}}}},{$inc:{remainingAmountMinor:-amount,chargebackAmountMinor:amount},$push:{events:{reference:event,owner,generation}}},{session});
    return updated.matchedCount===1;
   });
  }finally{await session.endSession();}
 }
 assert.equal(await settle("A",1,"evt-A",300),true,"A must settle first event");
 assert.equal((await owners.updateOne({_id:key,owner:"A",generation:1},{$set:{owner:"B"},$inc:{generation:1}})).matchedCount,1);
 await assert.rejects(()=>settle("A",1,"evt-new",200),{code:"AUD_OWNER_FENCED"},"superseded A cannot settle new evidence");
 assert.equal(await settle("B",2,"evt-A",300),false,"successor must not duplicate old evidence");
 assert.equal(await settle("B",2,"evt-B",200),true,"successor must settle distinct pending evidence");
 const row=await ledger.findOne({_id:payment});
 assert.equal(row.remainingAmountMinor,700);
 assert.equal(row.chargebackAmountMinor,500);
 assert.deepEqual(row.events.map(e=>e.reference),["evt-A","evt-B"]);
 assert.deepEqual(row.events.map(e=>e.owner),["A","B"]);
 console.log("AUD SUCCESSOR OWNER POSITIVE CANDIDATE GREEN: successor settles distinct pending evidence; stale predecessor fenced; replay excluded; isolated fixture ONLY, not production API certification");
}finally{await mongoose.disconnect();}
