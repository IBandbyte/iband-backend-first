import assert from "node:assert/strict";
import mongoose from "mongoose";
import {acquireRecoveryOwner,runWithRecoveryFence} from "../ai/MovieMentorCompletedChargebackRecoveryOwnerInternal.js";

// SECURITY RED: a caller who guesses owner/generation must never obtain a
// financial transaction merely by supplying a structurally matching object.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica set required");
await mongoose.connect(uri);
try{
 const connection=mongoose.connection;
 const actual=await acquireRecoveryOwner({connection,owner:"audit-authentic-worker",leaseMs:30000});
 const forged={owner:actual.owner,generation:actual.generation};
 let executed=false;
 await assert.rejects(
  runWithRecoveryFence({connection,capability:forged,work:async()=>{executed=true;}}),
  e=>e?.code==="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED",
  "structural owner/generation forgery must fail closed"
 );
 assert.equal(executed,false,"forged capability reached transaction callback");
 console.log("AUD INTERNAL OWNER CAPABILITY AUTHENTICITY GREEN: forged owner/generation denied before financial callback");
}finally{await mongoose.disconnect();}
