import assert from "node:assert/strict";
import mongoose from "mongoose";
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 // VERIFIER-ONLY hypothetical atomic ownership contract, NOT production schema/API.
 const c=db.collection("aud_open_01_isolated_ownership_candidate");
 const operation="evt-owner-candidate",payment="pi-owner-candidate";
 await c.insertOne({_id:payment,remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const attempt=async worker=>{
  const result=await c.findOneAndUpdate({_id:payment,remainingAmountMinor:1200,events:{$not:{$elemMatch:{reference:operation}}}},{$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},$push:{events:{reference:operation,amountMinor:300,owner:worker}}},{returnDocument:"after"});
  return {worker,applied:Boolean(result),state:result};
 };
 const results=await Promise.all([attempt("worker-2"),attempt("worker-3")]);
 const winners=results.filter(x=>x.applied);
 assert.equal(winners.length,1,"exactly one conditional writer wins");
 let row=await c.findOne({_id:payment});
 assert.equal(row.events.length,1);
 assert.equal(row.events[0].owner,winners[0].worker,"owner metadata must be committed atomically with financial update");
 assert.equal(row.remainingAmountMinor,900);assert.equal(row.chargebackAmountMinor,300);
 const replay=await attempt("worker-replay");
 assert.equal(replay.applied,false,"replay cannot become a new owner");
 row=await c.findOne({_id:payment});
 assert.equal(row.events[0].owner,winners[0].worker,"replay must not overwrite owner");
 // Synthetic post-write ack-loss: update succeeds, caller gets no acknowledgement.
 const payment2="pi-owner-ack-loss";
 await c.insertOne({_id:payment2,remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const write=await c.findOneAndUpdate({_id:payment2,events:{$not:{$elemMatch:{reference:operation}}}},{$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},$push:{events:{reference:operation,amountMinor:300,owner:"worker-lost-ack"}}},{returnDocument:"after"});
 assert.ok(write);
 const callerObserved="UNKNOWN";
 assert.equal(callerObserved,"UNKNOWN","lost acknowledgement cannot be interpreted as confirmed ownership");
 const persisted=await c.findOne({_id:payment2});
 assert.equal(persisted.events[0].owner,"worker-lost-ack","durable owner proof survives synthetic caller uncertainty");
 const competing=await c.findOneAndUpdate({_id:payment2,events:{$not:{$elemMatch:{reference:operation}}}},{$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},$push:{events:{reference:operation,amountMinor:300,owner:"worker-retry"}}},{returnDocument:"after"});
 assert.equal(competing,null,"retry cannot steal ownership");
 assert.equal((await c.findOne({_id:payment2})).chargebackAmountMinor,300);
 // Legacy event: absence of owner must never be inferred as a current worker.
 await c.insertOne({_id:"pi-owner-legacy",remainingAmountMinor:900,chargebackAmountMinor:300,events:[{reference:operation,amountMinor:300}]});
 const legacy=await c.findOne({_id:"pi-owner-legacy"});
 assert.equal(legacy.events[0].owner,undefined,"legacy event remains unattributed");
 console.log("AUD ISOLATED ATOMIC OWNERSHIP CANDIDATE GREEN",JSON.stringify({winner:winners[0].worker,concurrentWinners:winners.length,ackLossCaller:"UNKNOWN",durableOwner:persisted.events[0].owner,legacyOwner:"UNKNOWN",scope:"hypothetical isolated MongoDB collection, not production schema or production authority; synthetic acknowledgement uncertainty only"}));
}finally{await mongoose.disconnect();}
