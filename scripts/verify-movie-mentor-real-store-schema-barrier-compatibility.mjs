import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_real_store_schema_barrier_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:1200,maxProviderCalls:5,randomId:()=>`schema-barrier-${++seq}`});
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const reservations=mongoose.connection.collection("movie_mentor_inference_spend_reservation");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const outcomes=[];
try{
 for(const [label,barrier] of [["historical-missing",null],["raw-barrier",3]]){
  const projectId=`schema-barrier-${label}`,reservationId=`reservation-${label}`;
  await reservations.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId:"schema-creator",projectId,operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
  const opened=await authority.openExecution({creatorTurnId:`turn-${label}`,principalId:"schema-creator",projectId,reservationId,requestDigest:`sha256:${label}`,ownerId:"worker-A"});
  assert.equal(opened.authorized,true);
  const model=Object.values(mongoose.models).find(m=>m.collection?.name==="movie_mentor_inference_execution");
  assert.ok(model,"Real production execution Mongoose model must exist");
  assert.equal(model.schema.options.strict,true);
  assert.equal(model.schema.path("creatorDecisionBarrierRevision"),undefined);
  if(barrier!==null)await executions.updateOne({executionId:opened.executionId},{$set:{creatorDecisionBarrierRevision:barrier}});
  const before=await executions.findOne({executionId:opened.executionId});
  assert.equal(before.creatorDecisionBarrierRevision,barrier===null?undefined:barrier);
  const renewed=await authority.renewExecution(opened);
  assert.equal(renewed.authorized,true,JSON.stringify(renewed));
  const afterRenew=await executions.findOne({executionId:opened.executionId});
  assert.equal(afterRenew.creatorDecisionBarrierRevision,barrier===null?undefined:barrier,"Lease renewal must not erase barrier");
  await wait(2700);
  const acquired=await authority.acquireExecution({executionId:opened.executionId,ownerId:"worker-B"});
  assert.equal(acquired.authorized,true,JSON.stringify(acquired));
  assert.equal(acquired.leaseGeneration,opened.leaseGeneration+1);
  const afterTakeover=await executions.findOne({executionId:opened.executionId});
  assert.equal(afterTakeover.creatorDecisionBarrierRevision,barrier===null?undefined:barrier,"Lease takeover must not erase barrier");
  const read=await store.readExecution(opened.executionId);
  assert.equal(read.schema,6);
  assert.equal(read.leaseGeneration,acquired.leaseGeneration);
  outcomes.push({case:label,renewed:true,takenOver:true,rawBarrier:afterTakeover.creatorDecisionBarrierRevision??null,readableSchema:read.schema,modelDeclaresBarrier:false});
 }
 console.log(JSON.stringify({court:"real-store-schema-barrier-compatibility",classification:"isolated physical observation of current production Mongoose schema and lease writers; raw barrier is NOT production API or approved schema migration",outcomes}));
 console.log("PASS: current model lease renewal/takeover preserves missing and raw barrier representations");
}finally{await mongoose.disconnect();}
