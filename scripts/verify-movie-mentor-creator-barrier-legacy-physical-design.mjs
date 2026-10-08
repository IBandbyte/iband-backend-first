import assert from "node:assert/strict";
import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
assert.equal(uri, "mongodb://127.0.0.1:27017/iband_creator_barrier_legacy_design_court");
await mongoose.connect(uri, {serverSelectionTimeoutMS:10000});
const executions=mongoose.connection.collection("creator_barrier_design_executions");
const creators=mongoose.connection.collection("creator_barrier_design_states");
const id="execution-legacy-barrier-design";
const owner={ownerId:"worker-A",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"token-A"};
const binding={_id:id,phase:"active",...owner,leaseExpiresAt:new Date(Date.now()+60000)};
const outcomes=[];
async function reset(barrier){await executions.deleteMany({});await creators.deleteMany({});await executions.insertOne({...binding,...(barrier===undefined?{}:{creatorDecisionBarrierRevision:barrier})});await creators.insertOne({_id:"project-1",revision:7});}
async function commit({expectedBarrier,expectedRevision=7,ownerProof=owner}){
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const barrierMatch=expectedBarrier===0?{$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}]}:{creatorDecisionBarrierRevision:expectedBarrier};
   const updated=await executions.findOneAndUpdate({_id:id,phase:"active",...ownerProof,...barrierMatch,$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:expectedBarrier+1}},{session,returnDocument:"after"});
   if(!updated)throw Object.assign(new Error("barrier-or-lease-fenced"),{code:"BARRIER_FENCED"});
   const state=await creators.findOneAndUpdate({_id:"project-1",revision:expectedRevision},{$inc:{revision:1}},{session,returnDocument:"after"});
   if(!state)throw Object.assign(new Error("creator-revision-conflict"),{code:"REVISION_CONFLICT"});
   return {barrier:updated.creatorDecisionBarrierRevision,revision:state.revision};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
 }finally{await session.endSession();}
}
try{
 for(const [label,barrier] of [["missing",undefined],["explicit-zero",0],["positive",3]]){
  await reset(barrier);
  const expected=barrier??0;
  const result=await commit({expectedBarrier:expected});
  assert.equal(result.barrier,expected+1);
  assert.equal(result.revision,8);
  const durable=await executions.findOne({_id:id});
  assert.equal(durable.creatorDecisionBarrierRevision,expected+1);
  outcomes.push({case:label,status:"committed",barrier:durable.creatorDecisionBarrierRevision});
  let staleError=null;
  try{await commit({expectedBarrier:expected,expectedRevision:8});}catch(e){staleError=e;}
  assert.equal(staleError?.code,"BARRIER_FENCED");
  outcomes.push({case:label+"-stale-revision",status:"fenced"});
 }
 await reset(undefined);
 await executions.updateOne({_id:id},{$set:{ownerId:"worker-B",leaseGeneration:2,leaseReference:"lease-B",fencingToken:"token-B"}});
 let takeoverError=null;
 try{await commit({expectedBarrier:0});}catch(e){takeoverError=e;}
 assert.equal(takeoverError?.code,"BARRIER_FENCED");
 assert.equal((await creators.findOne({_id:"project-1"})).revision,7);
 outcomes.push({case:"takeover-before-commit",status:"fenced",creatorRevision:7});
 console.log(JSON.stringify({court:"creator-barrier-legacy-physical-design",classification:"isolated MongoDB transaction design fixture; NOT production integration or production lease-proof issuance",outcomes}));
 console.log("PASS: physical missing/zero/positive barrier and stale takeover design cases");
}finally{await mongoose.disconnect();}
