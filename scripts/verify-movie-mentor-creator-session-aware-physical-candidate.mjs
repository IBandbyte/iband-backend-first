import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {readAuthoritativeTurnSource} from "../ai/MovieMentorCreatorStateStore.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_creator_session_candidate_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const reservations=mongoose.connection.collection("movie_mentor_inference_spend_reservation");
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const creators=mongoose.connection.collection("movie_mentor_creator_state");
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:1200,maxProviderCalls:5,randomId:()=>`session-candidate-${++seq}`});
const results=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(name,revision){
 const projectId=`candidate-${name}`,reservationId=`reservation-${name}`;
 await reservations.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId:"candidate-principal",projectId,operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 if(revision>0)await creators.insertOne({projectId,creatorSessionId:"candidate-session",revision,revisionAuthorityReference:"ref-7",creatorStateGeneration:3,creatorStateFingerprint:"fingerprint-3",creatorAuthorityReference:"authority-3",snapshotReference:"snapshot-7",creatorConfirmedContext:[],compensationBarrierRevision:0,capturedAt:new Date()});
 const proof=await authority.openExecution({creatorTurnId:`turn-${name}`,principalId:"candidate-principal",projectId,reservationId,requestDigest:`sha256:${name}`,ownerId:"worker-A"});
 assert.equal(proof.authorized,true);
 return {projectId,revision,proof};
}
async function commit(item,{abort=false,afterAdmission=null}={}){
 const proof=await authority.assertFence(item.proof);
 assert.equal(proof.authorized,true);
 if(afterAdmission)await afterAdmission();
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const fence=await executions.findOneAndUpdate({executionId:proof.executionId,schema:6,phase:"active",ownerId:proof.ownerId,leaseGeneration:proof.leaseGeneration,leaseReference:proof.leaseReference,fencingToken:proof.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
   if(!fence)throw Object.assign(new Error("lease-fenced"),{code:"LEASE_FENCED"});
   const doc={projectId:item.projectId,creatorSessionId:"candidate-session",revision:item.revision+1,revisionAuthorityReference:"new-revision",creatorStateGeneration:4,creatorStateFingerprint:"new-fingerprint",creatorAuthorityReference:"new-authority",snapshotReference:"new-snapshot",creatorConfirmedContext:[],compensationBarrierRevision:0,capturedAt:new Date()};
   if(item.revision===0)await creators.insertOne(doc,{session});
   else{
    const updated=await creators.findOneAndUpdate({projectId:item.projectId,revision:item.revision,$or:[{compensationBarrierRevision:0},{compensationBarrierRevision:{$exists:false}}]},{$set:doc},{session,returnDocument:"after"});
    if(!updated)throw Object.assign(new Error("revision-fenced"),{code:"REVISION_FENCED"});
   }
   if(abort)throw Object.assign(new Error("deliberate-abort"),{code:"DELIBERATE_ABORT"});
   return doc.revision;
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
 }finally{await session.endSession();}
}
try{
 await creators.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 for(const [name,revision] of [["initial-create",0],["existing-update",7]]){
  const item=await setup(name,revision);
  let error;try{await commit(item,{abort:true});}catch(e){error=e;}
  assert.equal(error?.code,"DELIBERATE_ABORT");
  assert.equal((await creators.findOne({projectId:item.projectId}))?.revision??0,revision);
  assert.equal((await executions.findOne({executionId:item.proof.executionId})).creatorDecisionBarrierRevision,undefined);
  assert.equal(await commit(item),revision+1);
  let replay;try{await commit(item);}catch(e){replay=e;}
  assert.equal(replay?.code,"LEASE_FENCED");
  results.push({case:name,rollback:true,committedRevision:revision+1,replayFenced:true});
 }
 const item=await setup("takeover-after-admission",7);
 let b=null,staleError=null;
 try{await commit(item,{afterAdmission:async()=>{await wait(1800);b=await authority.acquireExecution({executionId:item.proof.executionId,ownerId:"worker-B"});assert.equal(b.authorized,true);}});}catch(e){staleError=e;}
 assert.equal(staleError?.code,"LEASE_FENCED");
 assert.equal((await creators.findOne({projectId:item.projectId})).revision,7);
 assert.equal(await commit({...item,proof:b}),8);
 results.push({case:"takeover-after-admission",staleFenced:true,currentWorkerCommitted:true});
 console.log(JSON.stringify({court:"creator-session-aware-physical-candidate",classification:"audit-only raw MongoDB creator write and execution barrier with real execution lease proof; NOT production creator-state writer, transition, ownership authority or repair",results}));
 console.log("PASS: audit-only session-aware candidate rollback, replay, and takeover");
}finally{await mongoose.disconnect();}
