import assert from "node:assert/strict";
import mongoose from "mongoose";
import {acquireRecoveryOwner,MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION} from "../ai/MovieMentorCompletedChargebackRecoveryOwnerInternal.js";

// VERIFIER FIRST: initial lease expiry must be based on MongoDB server time,
// even when the application wall clock is deliberately far in the future.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const connection=mongoose.connection;
 assert.ok((await connection.db.admin().command({hello:1})).setName,"replica set required");
 const realNow=Date.now;
 const driftMs=365*24*60*60*1000;
 try {
  Date.now=()=>realNow()+driftMs;
  const capability=await acquireRecoveryOwner({connection,owner:"audit-server-clock-A",leaseMs:30000});
  assert.equal(capability.generation,1);
 } finally {Date.now=realNow;}
 const lease=await connection.db.collection(MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION).findOne({_id:"completed-chargeback:stripe"});
 assert.ok(lease?.leaseUntil instanceof Date,"durable lease must have expiry");
 const expected=realNow()+30000;
 assert.ok(Math.abs(lease.leaseUntil.getTime()-expected)<10000,
  "PHYSICAL INITIAL-LEASE CLOCK RED: application clock drift contaminated durable lease expiry");
 console.log("AUD INITIAL LEASE SERVER CLOCK GREEN: one-year app clock drift cannot change MongoDB lease expiry");
} finally {await mongoose.disconnect();}
