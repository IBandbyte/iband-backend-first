import assert from "node:assert/strict";
import mongoose from "mongoose";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_concurrent_takeover_design_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const execution=mongoose.connection.collection("transaction_design_execution");
const creator=mongoose.connection.collection("transaction_design_creator");
const identity={_id:"execution-1",phase:"active",ownerId:"worker-A",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"token-A"};
const results=[];
const pause=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
async function reset(){await execution.deleteMany({});await creator.deleteMany({});await execution.insertOne({...identity,leaseExpiresAt:new Date(Date.now()+60000)});await creator.insertOne({_id:"project",revision:7});}
async function commitWithPause(ready,resume){
 const session=await mongoose.startSession();
 try{
  await session.withTransaction(async()=>{
   const claimed=await execution.findOneAndUpdate({...identity,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
   assert.ok(claimed,"execution barrier must be claimed");
   ready.release();await resume.promise;
   const written=await creator.findOneAndUpdate({_id:"project",revision:7},{$inc:{revision:1}},{session,returnDocument:"after"});
   assert.ok(written,"creator write must succeed in same session");
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"},maxCommitTimeMS:15000});
  return "committed";
 }catch(error){return error.codeName||error.code||error.message;}
 finally{ready.release();await session.endSession();}
}
async function takeover(){return execution.findOneAndUpdate({...identity},{$set:{ownerId:"worker-B",leaseGeneration:2,leaseReference:"lease-B",fencingToken:"token-B"}},{returnDocument:"after",maxTimeMS:12000});}
try{
 await reset();
 const ready=pause(),resume=pause();
 const committing=commitWithPause(ready,resume);
 await ready.promise;
 const racing=takeover().then(x=>({status:"success",value:x}),e=>({status:"error",code:e.codeName||e.code||e.message}));
 resume.release();
 const commitResult=await committing;
 const takeoverResult=await racing;
 const durable=await execution.findOne({_id:"execution-1"});
 const state=await creator.findOne({_id:"project"});
 assert.equal(commitResult,"committed",JSON.stringify({commitResult,takeoverResult}));
 assert.equal(state.revision,8);
 assert.equal(durable.creatorDecisionBarrierRevision,1);
 assert.equal(takeoverResult.status,"success",JSON.stringify(takeoverResult));
 assert.equal(durable.ownerId,"worker-B");
 results.push({case:"barrier-write-before-racing-takeover",commit:commitResult,takeover:takeoverResult.status,creatorRevision:state.revision,barrier:durable.creatorDecisionBarrierRevision});
 await reset();
 const first=await takeover();
 assert.equal(first.ownerId,"worker-B");
 const session=await mongoose.startSession();
 let stale=null;
 try{await session.withTransaction(async()=>{
  const claim=await execution.findOneAndUpdate({...identity,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}]},{$set:{creatorDecisionBarrierRevision:1}},{session});
  assert.equal(claim,null,"stale owner must not claim barrier");
  throw Object.assign(new Error("stale-fenced"),{code:"STALE_FENCED"});
 });}catch(e){stale=e.code||e.message;}finally{await session.endSession();}
 assert.equal(stale,"STALE_FENCED");
 assert.equal((await creator.findOne({_id:"project"})).revision,7);
 results.push({case:"takeover-first",stale:"fenced",creatorRevision:7});
 console.log(JSON.stringify({court:"concurrent-takeover-transaction-design",classification:"isolated MongoDB physical design fixture; does not exercise production execution store, expiry takeover rules, or private proof",results}));
 console.log("PASS: MongoDB write conflict serializes transaction barrier against racing takeover");
}finally{await mongoose.disconnect();}
