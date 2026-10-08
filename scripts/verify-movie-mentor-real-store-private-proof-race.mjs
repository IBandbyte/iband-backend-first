import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_real_store_proof_race_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:1200,maxProviderCalls:5,randomId:()=>`proof-race-${++seq}`});
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const creators=mongoose.connection.collection("proof_race_creator_states");
const projectId="proof-race-project",reservationId="proof-race-reservation";
const results=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function guardedCommit(evidence,{afterAdmission=null}={}){
 const proof=await authority.assertFence(evidence);
 if(proof.authorized!==true)throw Object.assign(new Error("private-proof-fenced"),{code:"PRIVATE_PROOF_FENCED"});
 if(afterAdmission)await afterAdmission();
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const updated=await executions.findOneAndUpdate({executionId:proof.executionId,schema:6,phase:"active",ownerId:proof.ownerId,leaseGeneration:proof.leaseGeneration,leaseReference:proof.leaseReference,fencingToken:proof.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
   if(!updated)throw Object.assign(new Error("physical-lease-fenced"),{code:"PHYSICAL_LEASE_FENCED"});
   const state=await creators.findOneAndUpdate({_id:projectId,revision:7},{$inc:{revision:1}},{session,returnDocument:"after"});
   if(!state)throw Object.assign(new Error("revision-conflict"),{code:"REVISION_CONFLICT"});
   return {revision:state.revision,barrier:updated.creatorDecisionBarrierRevision};
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
 }finally{await session.endSession();}
}
try{
 await mongoose.connection.collection("movie_mentor_inference_spend_reservation").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId:"proof-race-creator",projectId,operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 await creators.insertOne({_id:projectId,revision:7});
 const a=await authority.openExecution({creatorTurnId:"proof-race-turn",principalId:"proof-race-creator",projectId,reservationId,requestDigest:"sha256:proof-race",ownerId:"worker-A"});
 assert.equal(a.authorized,true);
 assert.equal((await authority.assertFence(a)).authorized,true);
 for(const [name,evidence] of [["spread-copy",{...a}],["json-copy",JSON.parse(JSON.stringify(a))],["forged-owner",{...a,ownerId:"worker-B"}]]){
  assert.equal((await authority.assertFence(evidence)).authorized,false);
  let error;try{await guardedCommit(evidence);}catch(caught){error=caught;}
  assert.equal(error?.code,"PRIVATE_PROOF_FENCED");
  results.push({case:name,status:"private-proof-fenced"});
 }
 let b;
 let error;
 try{
  await guardedCommit(a,{afterAdmission:async()=>{
   await wait(1800);
   b=await authority.acquireExecution({executionId:a.executionId,ownerId:"worker-B"});
   assert.equal(b.authorized,true);
   assert.equal((await authority.assertFence(a)).authorized,false);
  }});
 }catch(caught){error=caught;}
 assert.equal(error?.code,"PHYSICAL_LEASE_FENCED");
 assert.equal((await creators.findOne({_id:projectId})).revision,7);
 results.push({case:"genuine-proof-takeover-after-admission",status:"physical-lease-fenced",creatorRevision:7});
 const committed=await guardedCommit(b);
 assert.deepEqual(committed,{revision:8,barrier:1});
 results.push({case:"genuine-current-proof",status:"committed",creatorRevision:8,barrier:1});
 console.log(JSON.stringify({court:"real-store-private-proof-and-takeover-race",classification:"audit-only adapter, using real lease authority private evidence check before raw MongoDB transaction; NOT production sealed atomic writer; no ownership-authority integration",results}));
 console.log("PASS: copied and forged proof rejected; post-admission takeover fenced; genuine current worker committed");
}finally{await mongoose.disconnect();}
