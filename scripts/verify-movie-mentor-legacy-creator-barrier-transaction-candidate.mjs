import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {readAuthoritativeTurnSource} from "../ai/MovieMentorCreatorStateStore.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_legacy_creator_barrier_candidate_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
const reservations=mongoose.connection.collection("movie_mentor_inference_spend_reservation");
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const creators=mongoose.connection.collection("movie_mentor_creator_state");
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:1200,maxProviderCalls:5,randomId:()=>`session-candidate-${++seq}`});
const results=[];
// Candidate-only physical model: a dedicated barrier must be declared on the execution schema.
// Production does NOT yet contain this field or use this session-aware writer.
const executionModel=mongoose.model("MovieMentorCandidateCreatorBarrier",new mongoose.Schema({executionId:String,creatorDecisionBarrierRevision:{type:Number,min:0,default:0}},{strict:true,collection:"movie_mentor_inference_execution"}));
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
 if(proof.authorized!==true)throw Object.assign(new Error("private-proof-fenced"),{code:"PRIVATE_PROOF_FENCED"});
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
 const legacy=await setup("legacy-missing-barrier",7);
 const rawBefore=await executions.findOne({executionId:legacy.proof.executionId});
 assert.equal(rawBefore.creatorDecisionBarrierRevision,undefined,"physical legacy row must lack the field");
 const hydrated=await executionModel.findOne({executionId:legacy.proof.executionId});
 assert.equal(hydrated.creatorDecisionBarrierRevision,0,"candidate schema must default missing legacy field to zero");
 assert.equal(await commit(legacy),8);
 const rawAfter=await executions.findOne({executionId:legacy.proof.executionId});
 assert.equal(rawAfter.creatorDecisionBarrierRevision,1,"transaction must physically persist the barrier");
 assert.equal((await creators.findOne({projectId:legacy.projectId})).revision,8);
 results.push({case:"legacy-missing-barrier",physicalMissing:true,hydratedZero:true,physicallyPersistedOne:true});
 const recovery=await setup("post-commit-ack-loss",7);
 assert.equal(await commit(recovery),8);
 const recoveryRow=await creators.findOne({projectId:recovery.projectId});
 const recoveryBarrier=await executions.findOne({executionId:recovery.proof.executionId});
 assert.equal(recoveryRow.revision,8);
 assert.equal(recoveryBarrier.creatorDecisionBarrierRevision,1);
 // A simulated lost acknowledgement must not authorize another creator mutation.
 let replayError;try{await commit(recovery);}catch(e){replayError=e;}
 assert.equal(replayError?.code,"LEASE_FENCED");
 results.push({case:"post-commit-ack-loss",durableCreatorRevision:8,durableBarrier:1,replayFenced:true,classification:"candidate-only; not production idempotency recovery"});
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
 const concurrent=await setup("simultaneous-first-decision",7);
 const contenders=await Promise.allSettled([commit(concurrent),commit(concurrent)]);
 const wins=contenders.filter(x=>x.status==="fulfilled");
 const losses=contenders.filter(x=>x.status==="rejected");
 assert.equal(wins.length,1,"concurrent first decisions must have exactly one winner");
 assert.equal(losses.length,1,"concurrent first decisions must fence the loser");
 assert.equal((await creators.findOne({projectId:concurrent.projectId})).revision,8);
 assert.equal((await executions.findOne({executionId:concurrent.proof.executionId})).creatorDecisionBarrierRevision,1);
 results.push({case:"simultaneous-first-decision",singleWinner:true,loserFenced:true,revision:8});
 const guarded=await setup("private-proof-forgery",7);
 for(const forged of [{...guarded.proof},JSON.parse(JSON.stringify(guarded.proof))]){
  let rejected;try{await commit({...guarded,proof:forged});}catch(e){rejected=e;}
  assert.equal(rejected?.code,"PRIVATE_PROOF_FENCED");
 }
 assert.equal((await creators.findOne({projectId:guarded.projectId})).revision,7);
 assert.equal((await executions.findOne({executionId:guarded.proof.executionId})).creatorDecisionBarrierRevision,undefined);
 results.push({case:"private-proof-forgery",copiedProofBlocked:true});
 const item=await setup("takeover-after-admission",7);
 let b=null,staleError=null;
 try{await commit(item,{afterAdmission:async()=>{await wait(1800);b=await authority.acquireExecution({executionId:item.proof.executionId,ownerId:"worker-B"});assert.equal(b.authorized,true);}});}catch(e){staleError=e;}
 assert.equal(staleError?.code,"LEASE_FENCED");
 assert.equal((await creators.findOne({projectId:item.projectId})).revision,7);
 assert.equal(await commit({...item,proof:b}),8);
 results.push({case:"takeover-after-admission",staleFenced:true,currentWorkerCommitted:true});
 console.log(JSON.stringify({court:"legacy-creator-barrier-transaction-candidate",classification:"audit-only combined private WeakSet lease proof and atomic raw MongoDB creator write/barrier; NOT production creator-state writer, transition, ownership authority or repair",results}));
 console.log("PASS: audit-only legacy schema default, durable barrier, rollback, takeover, and replay");
}finally{await mongoose.disconnect();}
