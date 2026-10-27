import assert from "node:assert/strict";
import mongoose from "mongoose";
import {MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION,acquireRecoveryOwner,runWithRecoveryFence} from "../ai/MovieMentorCompletedChargebackRecoveryOwnerInternal.js";

// Independent executable court for the actual, still-dormant internal module.
// This is NOT a production integration verdict.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const connection=mongoose.connection,db=connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const leases=db.collection(MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION);
 const ledger=db.collection("aud_open_01_internal_owner_module_ledger");
 const first=await acquireRecoveryOwner({connection,owner:"audit-worker-A",leaseMs:1000});
 assert.equal(first.generation,1,"first owner must start at generation one");
 await assert.rejects(acquireRecoveryOwner({connection,owner:"audit-worker-B",leaseMs:1000}),e=>e.code==="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED","live owner must not be displaced");
 await ledger.insertOne({_id:"audit-financial-row",amount:100,events:[]});
 const apply=async(capability,reference)=>{
  await runWithRecoveryFence({connection,capability,work:async(session)=>{
   const r=await ledger.updateOne({_id:"audit-financial-row",events:{$ne:reference}},{$inc:{amount:-10},$addToSet:{events:reference}},{session});
   assert.equal(r.acknowledged,true);
   assert.equal(r.matchedCount,1,"one ledger effect required");
  }});
 };
 await apply(first,"evt-A");
 assert.equal((await ledger.findOne({_id:"audit-financial-row"})).amount,90);
 // Force expiry with a fixture-only database write, then exercise the real
 // module's server-time takeover predicate (no wall-clock sleep needed).
 await leases.updateOne({_id:"completed-chargeback:stripe"},{$set:{leaseUntil:new Date("2000-01-01")}});
 const second=await acquireRecoveryOwner({connection,owner:"audit-worker-B",leaseMs:30000});
 assert.equal(second.generation,2,"successor generation must increment");
 await assert.rejects(apply(first,"evt-stale"),e=>e.code==="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED","stale worker must fail closed");
 assert.equal((await ledger.findOne({_id:"audit-financial-row"})).amount,90,"stale worker must have zero effect");
 await apply(second,"evt-B");
 const row=await ledger.findOne({_id:"audit-financial-row"});
 assert.equal(row.amount,80);
 assert.deepEqual(row.events,["evt-A","evt-B"]);
 console.log("AUD INTERNAL OWNER MODULE COURT GREEN: acquired generation 1; live takeover denied; expired takeover generation 2; stale owner fenced; acknowledged owner+ledger transaction applied. NOT production integration.");
}finally{await mongoose.disconnect();}
