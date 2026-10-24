import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import mongoose from "mongoose";

// VERIFIER-ONLY diagnostic. A server-injected writeConcernError is NOT a
// severed TCP connection or proof of actual post-commit network ack loss.
// It probes whether a durable owner token survives an uncertain write result.
const uri=process.env.MONGO_URI;
assert.ok(uri&&(uri.startsWith("mongodb://127.0.0.1:27017/iband_aud_open_01")||uri.startsWith("mongodb://localhost:27017/iband_aud_open_01")),"isolated database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,retryWrites:false});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const c=db.collection("aud_open_01_postwrite_writeconcern_owner");
 const payment="pi-writeconcern-owner",reference="evt-writeconcern-owner",token=randomUUID();
 await c.insertOne({_id:payment,remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const settle=attemptToken=>c.findOneAndUpdate(
  {_id:payment,remainingAmountMinor:1200,events:{$not:{$elemMatch:{reference}}}},
  {$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},
   $push:{events:{reference,amountMinor:300,authorityAttemptToken:attemptToken}}},
  {returnDocument:"after",writeConcern:{w:"majority"}}
 );
 let callerOutcome="UNKNOWN",error=null;
 try {
  await db.admin().command({configureFailPoint:"failCommand",mode:{times:1},
   data:{failCommands:["findAndModify"],writeConcernError:{code:91,codeName:"ShutdownInProgress",errmsg:"AUD injected write concern uncertainty"}}});
  try {
   const result=await settle(token);
   callerOutcome=result?"ACKNOWLEDGED_WIN":"ACKNOWLEDGED_NO_WRITE";
  } catch(e) {
   error={name:e.name,code:e.code??null,message:e.message};
  }
 } finally {
  await db.admin().command({configureFailPoint:"failCommand",mode:"off"});
 }
 const row=await c.findOne({_id:payment});
 const events=row.events.filter(e=>e.reference===reference);
 assert.ok(events.length<=1,"one durable financial event maximum");
 assert.equal(row.remainingAmountMinor,1200-300*events.length);
 assert.equal(row.chargebackAmountMinor,300*events.length);
 const recovery=events.length===0?"NOT_COMMITTED":events[0].authorityAttemptToken===token?"DURABLE_ATTEMPT_MATCH":"OTHER_ATTEMPT";
 if(callerOutcome==="ACKNOWLEDGED_WIN")assert.equal(recovery,"DURABLE_ATTEMPT_MATCH");
 const competitor=await settle(randomUUID());
 assert.equal(Boolean(competitor),events.length===0,"competitor only succeeds if no first durable event");
 const final=await c.findOne({_id:payment});
 assert.equal(final.events.length,1);
 assert.equal(final.chargebackAmountMinor,300);
 assert.equal(final.remainingAmountMinor,900);
 assert.equal(await settle(randomUUID()),null,"replay cannot mint a second owner");
 console.log("AUD POSTWRITE WRITECONCERN OWNERSHIP DIAGNOSTIC",JSON.stringify({
  callerOutcome,error,durableAfterFirstAttempt:events.length,recovery,finalEvents:final.events.length,
  scope:"isolated MongoDB server writeConcernError injection, not real network acknowledgement loss and not production authority"
 }));
 assert.ok(error,"server write concern uncertainty must be observed; otherwise inconclusive");
 assert.equal(events.length,1,"durable write despite reported uncertainty required for this court");
 assert.equal(recovery,"DURABLE_ATTEMPT_MATCH","only durable matching token proves original attempt");
} finally { await mongoose.disconnect(); }
