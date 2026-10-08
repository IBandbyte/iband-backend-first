import assert from "node:assert/strict";
import mongoose from "mongoose";

// Physical design court only: synthetic collections, NOT production integration.
// Force the stale transaction to write its lease barrier before worker B's takeover.
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_first_commit_takeover_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const executions=mongoose.connection.collection("court_takeover_interleaving_execution");
const creators=mongoose.connection.collection("court_takeover_interleaving_creator");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function seed(id,existing){
 await executions.insertOne({_id:id,projectId:id,creatorTurnId:"turn-"+id,phase:"active",ownerId:"A",leaseGeneration:1,leaseReference:"A",fencingToken:"fence-A",leaseExpiresAt:new Date(Date.now()+900),creatorDecisionBarrierRevision:0});
 if(existing)await creators.insertOne({_id:id,revision:7,decisions:[]});
}
async function runCase(existing){
 const id=existing?"interleaved-update":"interleaved-create";
 await seed(id,existing);
 const session=await mongoose.startSession();
 let release;
 const blocked=new Promise(resolve=>{release=resolve});
 let signal;
 const barrierWritten=new Promise(resolve=>{signal=resolve});
 let workerB=null;
 let workerA=null;
 let workerAError=null;
 try{
  const workerATask=session.withTransaction(async()=>{
   const fenced=await executions.updateOne({_id:id,phase:"active",ownerId:"A",leaseGeneration:1,leaseReference:"A",fencingToken:"fence-A",creatorTurnId:"turn-"+id,creatorDecisionBarrierRevision:0,$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$inc:{creatorDecisionBarrierRevision:1}},{session});
   assert.equal(fenced.modifiedCount,1,"Worker A must write its execution barrier inside the transaction");
   signal();
   await blocked;
   if(existing){
    const updated=await creators.updateOne({_id:id,revision:7},{$set:{revision:8,decisions:["A"]}},{session});
    assert.equal(updated.modifiedCount,1);
   }else await creators.insertOne({_id:id,revision:1,decisions:["A"]},{session});
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},maxCommitTimeMS:5000}).then(()=>{workerA="committed"}).catch(e=>{workerAError=e;workerA="aborted"});
  await barrierWritten;
  await sleep(1100);
  const takeover=executions.findOneAndUpdate({_id:id,phase:"active",ownerId:"A",leaseGeneration:1,$expr:{$lte:["$leaseExpiresAt","$$NOW"]}},{$set:{ownerId:"B",leaseGeneration:2,leaseReference:"B",fencingToken:"fence-B",leaseExpiresAt:new Date(Date.now()+60000)}},{returnDocument:"after",maxTimeMS:5000});
  // A's transactional write holds the same execution document: B cannot
  // commit its takeover concurrently before A resolves. Release A promptly.
  await sleep(150);
  release();
  await workerATask;
  try{workerB=await takeover;}catch(e){workerB={error:e.code||e.codeName||e.message}};
  const durable=await creators.findOne({_id:id});
  const current=await executions.findOne({_id:id});
  assert.equal(workerA,"committed","Transaction with already-admitted lease barrier must resolve before competing takeover");
  assert.equal(durable.revision,existing?8:1);
  assert.equal(current.creatorDecisionBarrierRevision,1);
  assert.ok(workerB===null||workerB.error||workerB.ownerId==="B","Takeover outcome must be classified");
  return {branch:existing?"update":"create",workerA,workerB:workerB?.error?"error:"+workerB.error:workerB?.ownerId||"not-matched",durableRevision:durable.revision,barrier:current.creatorDecisionBarrierRevision,qualification:"This tests serialization, not a strict prohibition on commits after wall-clock expiry"};
 }finally{release?.();await session.endSession();}
}
try{
 const create=await runCase(false);
 const update=await runCase(true);
 console.log(JSON.stringify({court:"lease-barrier-versus-takeover-interleaving-design",create,update,classification:"synthetic physical transaction concurrency; NOT production integration"}));
 console.log("PASS: transaction execution barrier serializes against competing takeover");
}finally{await mongoose.disconnect();}
