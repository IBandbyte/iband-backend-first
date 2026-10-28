import assert from "node:assert/strict";
import mongoose from "mongoose";

// Diagnostic only: genuine MongoDB failCommand at commitTransaction.
// This does NOT by itself prove that signed ingress loses acknowledgement.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const coll=db.collection("aud_open_01_commit_ack_probe");
 const key="commit-ack-multiple-loss-probe";
 const session=await mongoose.startSession();
 let attempts=0,callbackRuns=0,outcome="unknown",errorCode=null,labels=[];
 try{
  // Genuine mongod failCommand: three connection closures on commitTransaction.
  // MongoDB driver may retry commit and return success; do not force a RED.
  await db.admin().command({configureFailPoint:"failCommand",mode:{times:3},data:{failCommands:["commitTransaction"],closeConnection:true}});
  attempts=3;
  try{
   await session.withTransaction(async()=>{
    callbackRuns++;
    await coll.insertOne({_id:key,probe:"commit-ack",callbackRuns},{session});
   });
   outcome="resolved";
  }catch(error){
   outcome="rejected";
   errorCode=error?.code??null;
   labels=Array.isArray(error?.errorLabels)?error.errorLabels:[];
  }
 }finally{
  try{await db.admin().command({configureFailPoint:"failCommand",mode:"off"});}catch(error){console.error("FAILPOINT_CLEANUP_ERROR",error.message);throw error;}
  await session.endSession();
 }
 const row=await coll.findOne({_id:key});
 assert.ok(["resolved","rejected"].includes(outcome));
 assert.equal(callbackRuns,1,"commit retry must not rerun transaction callback");
 if(outcome==="resolved")assert.ok(row,"successful driver acknowledgement must have durable commit");
 if(outcome==="rejected"&&row)console.log("AUD MULTIPLE COMMIT FAILCOMMAND DIAGNOSTIC: DURABLE COMMIT + CALLER REJECTION OBSERVED");
 else console.log("AUD MULTIPLE COMMIT FAILCOMMAND DIAGNOSTIC: NO DURABLE-COMMIT/CALLER-REJECTION PAIR",JSON.stringify({outcome,durable:!!row,errorCode,labels}));
 console.log("AUD MULTIPLE COMMIT FAILPOINT OBSERVATION",JSON.stringify({outcome,durable:!!row,callbackRuns,attempts,errorCode,labels}));
}finally{await mongoose.disconnect();}
