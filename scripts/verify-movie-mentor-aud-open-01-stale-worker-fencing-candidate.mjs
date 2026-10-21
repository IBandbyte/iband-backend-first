import assert from "node:assert/strict";
import mongoose from "mongoose";

// VERIFIER-ONLY candidate. This does not exercise a production checkpoint owner.
// A physical Mongo replica set establishes stale-generation fencing semantics.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"physical replica set required");
 const checkpoints=db.collection("aud_open_01_lease_fencing_candidate");
 await checkpoints.createIndex({domain:1},{unique:true});
 const key={domain:"chargeback-reconciliation"};
 const first=await checkpoints.findOneAndUpdate(key,{$setOnInsert:{generation:1,owner:"worker-A",cursor:"receipt-010",cycle:1,leaseUntil:1000}},{upsert:true,returnDocument:"after"});
 assert.equal(first.generation,1);
 // A is paused while its database lease expires. B obtains a strictly newer
 // generation; time is an explicit deterministic DB-state fixture, not wall clock.
 const takeover=await checkpoints.findOneAndUpdate({...key,generation:1,owner:"worker-A",leaseUntil:{$lte:2000}},{$set:{owner:"worker-B",leaseUntil:3000},$inc:{generation:1}},{returnDocument:"after"});
 assert.equal(takeover?.generation,2,"new owner must acquire a higher fencing generation");
 assert.equal(takeover?.owner,"worker-B");
 // A wakes up and attempts to persist its stale page progress.
 const stale=await checkpoints.updateOne({...key,generation:1,owner:"worker-A",leaseUntil:{$gt:2000}},{$set:{cursor:"receipt-999",cycle:99}});
 assert.equal(stale.matchedCount,0,"expired owner must not match the current checkpoint");
 const current=await checkpoints.findOne(key);
 assert.equal(current.cursor,"receipt-010","stale worker cannot overwrite the successor's checkpoint");
 assert.equal(current.cycle,1);
 // The successor may advance only with its current generation and valid lease.
 const live=await checkpoints.updateOne({...key,generation:2,owner:"worker-B",leaseUntil:{$gt:2000}},{$set:{cursor:"receipt-020"}});
 assert.equal(live.matchedCount,1);
 // A second competing worker cannot claim B's lease while it remains valid.
 const premature=await checkpoints.findOneAndUpdate({...key,generation:2,owner:"worker-B",leaseUntil:{$lte:2000}},{$set:{owner:"worker-C"},$inc:{generation:1}},{returnDocument:"after"});
 assert.equal(premature,null,"unexpired owner must remain authoritative");
 const after=await checkpoints.findOne(key);
 assert.equal(after.generation,2);
 assert.equal(after.owner,"worker-B");
 assert.equal(after.cursor,"receipt-020");
 console.log("AUD STALE-WORKER FENCING CANDIDATE GREEN: isolated physical Mongo CAS excludes expired generation and preserves successor progress; production checkpoint, distributed scheduling, financial settlement and DB-server-time lease semantics remain unproven");
}finally{await mongoose.disconnect();}
