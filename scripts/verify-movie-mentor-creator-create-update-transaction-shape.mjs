import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_creator_transaction_shape_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:30000,maxProviderCalls:5,randomId:()=>`shape-${++seq}`});
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const reservations=mongoose.connection.collection("movie_mentor_inference_spend_reservation");
const creatorSchema=new mongoose.Schema({projectId:{type:String,required:true},revision:{type:Number,required:true},creatorStateGeneration:{type:Number,required:true},creatorStateFingerprint:{type:String,required:true},revisionAuthorityReference:{type:String,required:true}},{strict:true});
creatorSchema.index({projectId:1},{unique:true});
const Creator=mongoose.model("AuditCreatorTransactionShape",creatorSchema,"audit_creator_transaction_shape");
await Creator.createIndexes();
const outcomes=[];
async function setup(name,revision){
 const projectId=`shape-${name}`,reservationId=`reservation-${name}`;
 await reservations.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId:"shape-principal",projectId,operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 const evidence=await authority.openExecution({creatorTurnId:`turn-${name}`,principalId:"shape-principal",projectId,reservationId,requestDigest:`sha256:${name}`,ownerId:"worker-A"});
 assert.equal(evidence.authorized,true);
 if(revision>0)await Creator.create({projectId,revision,creatorStateGeneration:revision,creatorStateFingerprint:`old-${name}`,revisionAuthorityReference:`old-ref-${name}`});
 return {projectId,evidence,revision};
}
async function commit({projectId,evidence,revision},{failAfterBarrier=false}={}){
 const admission=await authority.assertFence(evidence);
 assert.equal(admission.authorized,true);
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const updated=await executions.findOneAndUpdate({executionId:admission.executionId,schema:6,phase:"active",ownerId:admission.ownerId,leaseGeneration:admission.leaseGeneration,leaseReference:admission.leaseReference,fencingToken:admission.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
   if(!updated)throw Object.assign(new Error("lease-fenced"),{code:"LEASE_FENCED"});
   if(failAfterBarrier)throw Object.assign(new Error("deliberate-abort"),{code:"DELIBERATE_ABORT"});
   const doc={projectId,revision:revision+1,creatorStateGeneration:revision+1,creatorStateFingerprint:`new-${projectId}`,revisionAuthorityReference:`new-ref-${projectId}`};
   if(revision===0){await Creator.create([doc],{session});}
   else{
    const state=await Creator.findOneAndUpdate({projectId,revision},{$set:doc},{new:true,runValidators:true,session}).lean().exec();
    if(!state)throw Object.assign(new Error("creator-revision-conflict"),{code:"REVISION_CONFLICT"});
   }
   return revision+1;
  },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
 }finally{await session.endSession();}
}
try{
 for(const revision of [0,7]){
  const name=revision===0?"initial-create":"existing-update";
  const item=await setup(name,revision);
  let error;try{await commit(item,{failAfterBarrier:true});}catch(e){error=e;}
  assert.equal(error?.code,"DELIBERATE_ABORT");
  assert.equal((await executions.findOne({executionId:item.evidence.executionId})).creatorDecisionBarrierRevision,undefined);
  assert.equal((await Creator.findOne({projectId:item.projectId}).lean())?.revision??0,revision);
  const committed=await commit(item);
  assert.equal(committed,revision+1);
  assert.equal((await executions.findOne({executionId:item.evidence.executionId})).creatorDecisionBarrierRevision,1);
  assert.equal((await Creator.findOne({projectId:item.projectId}).lean()).revision,revision+1);
  let repeatError;try{await commit(item);}catch(e){repeatError=e;}
  assert.equal(repeatError?.code,"LEASE_FENCED");
  outcomes.push({case:name,abortedTogether:true,committedTogether:true,repeatedBarrierFenced:true,creatorRevision:revision+1});
 }
 console.log(JSON.stringify({court:"creator-create-update-transaction-shape",classification:"audit-only transaction fixture using real execution store and genuine proof plus isolated creator Mongoose model; NOT production creator writer or sealed API",outcomes}));
 console.log("PASS: initial create and existing revision update share atomic execution barrier, rollback, and replay fence");
}finally{await mongoose.disconnect();}
