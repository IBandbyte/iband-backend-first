import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_real_store_barrier_adapter_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:1200,maxProviderCalls:5,randomId:()=>`adapter-${++seq}`});
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const creators=mongoose.connection.collection("barrier_adapter_creator_states");
const reservationId="reservation-adapter-1",projectId="adapter-project";
try{
 await mongoose.connection.collection("movie_mentor_inference_spend_reservation").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId:"adapter-creator",projectId,operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 await creators.insertOne({_id:projectId,revision:7});
 const workerA=await authority.openExecution({creatorTurnId:"adapter-turn",principalId:"adapter-creator",projectId,reservationId,requestDigest:"sha256:adapter-court",ownerId:"worker-A"});
 assert.equal(workerA.authorized,true);
 assert.equal((await authority.assertFence(workerA)).authorized,true);
 await new Promise(resolve=>setTimeout(resolve,1800));
 const workerB=await authority.acquireExecution({executionId:workerA.executionId,ownerId:"worker-B"});
 assert.equal(workerB.authorized,true);
 assert.equal((await authority.assertFence(workerA)).authorized,false);
 const outcomes=[];
 async function commitBarrier(evidence){
  const session=await mongoose.startSession();
  try{
   return await session.withTransaction(async()=>{
    const execution=await executions.findOneAndUpdate({executionId:evidence.executionId,phase:"active",schema:6,ownerId:evidence.ownerId,leaseGeneration:evidence.leaseGeneration,leaseReference:evidence.leaseReference,fencingToken:evidence.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
    if(!execution)throw Object.assign(new Error("lease-or-barrier-fenced"),{code:"LEASE_BARRIER_FENCED"});
    const state=await creators.findOneAndUpdate({_id:projectId,revision:7},{$inc:{revision:1}},{session,returnDocument:"after"});
    if(!state)throw Object.assign(new Error("revision-conflict"),{code:"REVISION_CONFLICT"});
    return {revision:state.revision,barrier:execution.creatorDecisionBarrierRevision};
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  }finally{await session.endSession();}
 }
 let staleError;
 try{await commitBarrier(workerA);}catch(error){staleError=error;}
 assert.equal(staleError?.code,"LEASE_BARRIER_FENCED");
 assert.equal((await creators.findOne({_id:projectId})).revision,7);
 outcomes.push({case:"real-store-issued-stale-worker",status:"fenced",creatorRevision:7});
 const valid=await commitBarrier(workerB);
 assert.equal(valid.revision,8);
 assert.equal(valid.barrier,1);
 outcomes.push({case:"real-store-issued-current-worker",status:"committed",creatorRevision:8,barrier:1});
 const durable=await store.readExecution(workerB.executionId);
 assert.equal(durable.executionId,workerB.executionId);
 assert.equal(durable.schema,6);
 console.log(JSON.stringify({court:"real-store-barrier-adapter",classification:"audit-only raw MongoDB adapter using genuine production-issued evidence; NOT a production store API, creator-state writer, or sealed proof-bound commit",outcomes,readableSchema:durable.schema}));
 console.log("PASS: real execution store evidence and raw MongoDB transactional barrier adapter");
}finally{await mongoose.disconnect();}
