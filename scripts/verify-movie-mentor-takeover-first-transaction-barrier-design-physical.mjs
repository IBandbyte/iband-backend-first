import assert from "node:assert/strict";
import mongoose from "mongoose";

// Audit-only physical design court: synthetic collections, NOT production integration.
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const executions=mongoose.connection.collection("court_takeover_first_transaction_execution");
const creators=mongoose.connection.collection("court_takeover_first_transaction_creator");
async function runCase(existing){
 const id=existing?"takeover-first-update":"takeover-first-create";
 await executions.insertOne({_id:id,projectId:id,creatorTurnId:"turn-"+id,phase:"active",ownerId:"A",leaseGeneration:1,leaseReference:"A",fencingToken:"fence-A",leaseExpiresAt:new Date(Date.now()-1000),creatorDecisionBarrierRevision:0});
 if(existing)await creators.insertOne({_id:id,revision:7,decisions:[]});
 const takeover=await executions.findOneAndUpdate({_id:id,ownerId:"A",leaseGeneration:1,$expr:{$lte:["$leaseExpiresAt","$$NOW"]}},{$set:{ownerId:"B",leaseGeneration:2,leaseReference:"B",fencingToken:"fence-B",leaseExpiresAt:new Date(Date.now()+60000)}},{returnDocument:"after"});
 assert.equal(takeover?.ownerId,"B","B must win the physical takeover before A starts its transaction");
 const session=await mongoose.startSession();
 let staleCommit=false;
 try{
  await session.withTransaction(async()=>{
   const barrier=await executions.updateOne({_id:id,phase:"active",ownerId:"A",leaseGeneration:1,leaseReference:"A",fencingToken:"fence-A",creatorTurnId:"turn-"+id,creatorDecisionBarrierRevision:0,$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$inc:{creatorDecisionBarrierRevision:1}},{session});
   assert.equal(barrier.modifiedCount,1,"FENCING RED: stale worker must not acquire decision barrier after takeover");
   if(existing)await creators.updateOne({_id:id,revision:7},{$set:{revision:8,decisions:["A"]}},{session});
   else await creators.insertOne({_id:id,revision:1,decisions:["A"]},{session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  staleCommit=true;
 }catch(e){
  assert.match(String(e?.message),/stale worker must not acquire decision barrier/,"Unexpected transaction failure");
 }finally{await session.endSession();}
 assert.equal(staleCommit,false);
 const execution=await executions.findOne({_id:id});
 const creator=await creators.findOne({_id:id});
 assert.equal(execution.ownerId,"B");
 assert.equal(execution.leaseGeneration,2);
 assert.equal(execution.creatorDecisionBarrierRevision,0);
 if(existing){assert.equal(creator.revision,7);assert.deepEqual(creator.decisions,[]);}
 else assert.equal(creator,null);
 return {branch:existing?"update":"create",takeover:"B",staleBarrier:"rejected",creatorRevision:creator?.revision??null,barrier:execution.creatorDecisionBarrierRevision};
}
try{
 const create=await runCase(false);
 const update=await runCase(true);
 console.log(JSON.stringify({court:"takeover-first-transaction-barrier-design-physical",create,update,classification:"synthetic MongoDB transaction design; NOT production integration"}));
 console.log("PASS: takeover-first blocks stale barrier and creator-state writes");
}finally{await mongoose.disconnect();}
