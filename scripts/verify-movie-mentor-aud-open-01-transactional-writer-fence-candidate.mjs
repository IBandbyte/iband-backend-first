import assert from "node:assert/strict";
import mongoose from "mongoose";

// VERIFIER-ONLY MongoDB replica-set court. No production lease or writer is changed.
// This establishes the atomicity requirement for a future production integration.
const uri=process.env.MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated audit database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const leases=db.collection("aud_open_01_transactional_fence_lease");
 const ledger=db.collection("aud_open_01_transactional_fence_ledger");
 await leases.insertOne({_id:"completed-chargeback",owner:"A",generation:1,leaseUntil:new Date("2999-01-01")});
 await ledger.insertOne({_id:"pi-transaction-fence",remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const key="completed-chargeback",payment="pi-transaction-fence",event="evt-transaction-fence";
 const settle=async(session,owner,generation)=>{
  // This is deliberately a WRITE to the ownership document in the SAME transaction
  // as the financial mutation, so a concurrent transfer conflicts with this writer.
  const fence=await leases.updateOne({_id:key,owner,generation,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$inc:{writerFenceRevision:1}},{session});
  if(fence.matchedCount!==1) {
   const error=new Error("stale recovery owner");error.code="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED";throw error;
  }
  const effect=await ledger.updateOne({_id:payment,remainingAmountMinor:1200,events:{$not:{$elemMatch:{reference:event}}}},{$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},$push:{events:{reference:event,owner,generation}}},{session});
  assert.equal(effect.matchedCount,1,"exactly one financial effect expected");
 };
 // Court 1: B transfers before A starts its transaction. A must fail closed.
 await leases.updateOne({_id:key,owner:"A",generation:1},{$set:{owner:"B"},$inc:{generation:1}});
 let fenced=false;
 const stale=await mongoose.startSession();
 try {
  await stale.withTransaction(async()=>{await settle(stale,"A",1);});
 }catch(error){if(error.code!=="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED")throw error;fenced=true;}
 finally{await stale.endSession();}
 assert.equal(fenced,true,"superseded A must be explicitly fenced");
 assert.equal((await ledger.findOne({_id:payment})).events.length,0,"stale owner must have zero financial effect");
 // Court 2: B holds an uncommitted fence+ledger transaction; C attempts transfer.
 // Transfer must not successfully commit while B's transaction is in flight.
 const active=await mongoose.startSession();active.startTransaction();
 try {
  await settle(active,"B",2);
  let transferRejected=false;
  try {
   await leases.updateOne({_id:key,owner:"B",generation:2},{$set:{owner:"C"},$inc:{generation:1}},{maxTimeMS:750});
  }catch(error){
   // A timed-out conflicting transfer is NOT proof of a successful takeover.
   if(!["MaxTimeMSExpired","WriteConflict"].includes(error.codeName))throw error;
   transferRejected=true;
  }
  assert.equal(transferRejected,true,"concurrent transfer must not bypass in-flight lease-document write");
  await active.commitTransaction();
 }finally{if(active.inTransaction())await active.abortTransaction();await active.endSession();}
 let row=await ledger.findOne({_id:payment});
 assert.equal(row.remainingAmountMinor,900);
 assert.equal(row.chargebackAmountMinor,300);
 assert.equal(row.events.length,1);
 assert.equal(row.events[0].owner,"B");
 assert.equal(row.events[0].generation,2);
 // After B commits, C can transfer, but cannot apply the same evidence again.
 const transfer=await leases.updateOne({_id:key,owner:"B",generation:2},{$set:{owner:"C"},$inc:{generation:1}});
 assert.equal(transfer.matchedCount,1);
 const replay=await ledger.updateOne({_id:payment,events:{$not:{$elemMatch:{reference:event}}}},{$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},$push:{events:{reference:event,owner:"C",generation:3}}});
 assert.equal(replay.matchedCount,0,"successor replay must not duplicate financial evidence");
 row=await ledger.findOne({_id:payment});
 assert.equal(row.events.length,1);
 console.log("AUD TRANSACTIONAL OWNER/LEDGER FENCE CANDIDATE GREEN: isolated Mongo lease-document write conflicts with takeover; stale generation rejected; one financial effect. NOT production integration or certification.");
}finally{await mongoose.disconnect();}
