import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import mongoose from "mongoose";

// VERIFIER ONLY. Isolated MongoDB, hypothetical ownership-bearing financial CAS.
// A genuine mongod connection closure is injected at findAndModify. This does
// NOT guarantee that the server committed before closing the connection.
const uri=process.env.MONGO_URI;
assert.ok(uri&&uri.startsWith("mongodb://127.0.0.1:27017/iband_aud_open_01")||uri&&uri.startsWith("mongodb://localhost:27017/iband_aud_open_01"),"isolated database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,retryWrites:false});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const c=db.collection("aud_open_01_genuine_write_loss_owner");
 const reference="evt-genuine-write-loss",payment="pi-genuine-write-loss";
 await c.insertOne({_id:payment,remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const attemptToken=randomUUID();
 const settle=token=>c.findOneAndUpdate(
  {_id:payment,remainingAmountMinor:1200,events:{$not:{$elemMatch:{reference}}}},
  {$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},
   $push:{events:{reference,amountMinor:300,authorityAttemptToken:token}}},
  {returnDocument:"after"}
 );
 let callerOutcome="UNKNOWN",failure=null;
 try {
  await db.admin().command({configureFailPoint:"failCommand",mode:{times:1},
   data:{failCommands:["findAndModify"],closeConnection:true}});
  try {
   const result=await settle(attemptToken);
   callerOutcome=result?"ACKNOWLEDGED_WIN":"ACKNOWLEDGED_NO_WRITE";
  } catch(e) {
   failure={name:e.name,code:e.code??null,labels:Array.isArray(e.errorLabels)?e.errorLabels:[]};
   callerOutcome="UNKNOWN";
  }
 } finally {
  await db.admin().command({configureFailPoint:"failCommand",mode:"off"});
 }
 // Recovery MUST read durable evidence. An UNKNOWN caller response never
 // becomes a winner merely because the same reference is now settled.
 const row=await c.findOne({_id:payment});
 const events=row.events.filter(e=>e.reference===reference);
 assert.ok(events.length<=1,"no duplicate durable financial event");
 assert.ok([0,1].includes(events.length));
 assert.equal(row.remainingAmountMinor,1200-300*events.length);
 assert.equal(row.chargebackAmountMinor,300*events.length);
 const reconciled=events.length===0?"NOT_COMMITTED":
  events[0].authorityAttemptToken===attemptToken?"DURABLE_ATTEMPT_MATCH":"OTHER_ATTEMPT";
 if(callerOutcome==="ACKNOWLEDGED_WIN")assert.equal(reconciled,"DURABLE_ATTEMPT_MATCH");
 if(callerOutcome==="ACKNOWLEDGED_NO_WRITE")assert.equal(reconciled,"NOT_COMMITTED");
 const competing=await settle(randomUUID());
 assert.equal(Boolean(competing),events.length===0,"only an unsettled event permits another winner");
 const final=await c.findOne({_id:payment});
 assert.equal(final.events.length,1,"exactly one financial settlement after bounded retry");
 assert.equal(final.remainingAmountMinor,900);
 assert.equal(final.chargebackAmountMinor,300);
 const replay=await settle(randomUUID());
 assert.equal(replay,null,"replay must not mint ownership");
 assert.equal((await c.findOne({_id:payment})).events.length,1);
 // A token proves this attempt only if its value is read from the atomic
 // financial event. It does not authenticate the worker or its identity.
 console.log("AUD GENUINE WRITE-LOSS OWNERSHIP DIAGNOSTIC",JSON.stringify({
  callerOutcome,connectionFailureObserved:!!failure,failure,
  durableAfterFirstAttempt:events.length,reconciled,finalSettlements:final.events.length,
  scope:"genuine failCommand findAndModify connection closure; isolated candidate, not production authority; commit-before-disconnect NOT guaranteed"
 }));
 assert.ok(failure,"genuine connection failure must be physically observed; otherwise this court is inconclusive");
} finally {
 await mongoose.disconnect();
}
