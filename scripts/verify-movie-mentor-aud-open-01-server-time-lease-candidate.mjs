import assert from "node:assert/strict";
import mongoose from "mongoose";
// AUD-OPEN-01 verifier-only physical candidate. MongoDB $$NOW supplies the lease
// clock; application-supplied time is never trusted. Not production authority.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set URI required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const c=db.collection("aud_server_time_lease_candidate");
 await c.createIndex({domain:1},{unique:true});
 const key={domain:"recovery"};
 await c.insertOne({...key,generation:1,owner:"A",cursor:"receipt-010",leaseUntil:new Date(0)});
 const takeover=await c.findOneAndUpdate({...key,owner:"A",generation:1,$expr:{$lte:["$leaseUntil","$$NOW"]}},[{$set:{owner:"B",generation:{$add:["$generation",1]},leaseUntil:{$dateAdd:{startDate:"$$NOW",unit:"minute",amount:5}}}}],{returnDocument:"after"});
 assert.equal(takeover?.generation,2);
 assert.equal(takeover?.owner,"B");
 assert.ok(takeover.leaseUntil instanceof Date);
 const stale=await c.updateOne({...key,owner:"A",generation:1,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$set:{cursor:"forged",generation:99}});
 assert.equal(stale.matchedCount,0,"stale owner cannot overwrite newer generation");
 const unauthorized=await c.findOneAndUpdate({...key,owner:"B",generation:2,$expr:{$lte:["$leaseUntil","$$NOW"]}},[{$set:{owner:"C",generation:{$add:["$generation",1]}}}],{returnDocument:"after"});
 assert.equal(unauthorized,null,"unexpired lease cannot be stolen");
 const advance=await c.updateOne({...key,owner:"B",generation:2,$expr:{$gt:["$leaseUntil","$$NOW"]}},{$set:{cursor:"receipt-020"}});
 assert.equal(advance.matchedCount,1);
 const final=await c.findOne(key);
 assert.equal(final.generation,2);
 assert.equal(final.owner,"B");
 assert.equal(final.cursor,"receipt-020");
 console.log("AUD SERVER-TIME LEASE FENCING CANDIDATE GREEN: physical Mongo $$NOW governs takeover and current-owner writes; no production integration, crash recovery, autonomous trigger or financial settlement certified");
}finally{await mongoose.disconnect();}
