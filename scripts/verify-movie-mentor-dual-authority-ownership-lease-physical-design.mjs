import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {createMovieMentorCreatorStateMutationAuthority,assertMovieMentorCreatorStateMutationAuthority} from "../ai/MovieMentorCreatorStateMutationAuthority.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_dual_authority_court");
await mongoose.connect(process.env.MONGO_URI);
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0,ownershipRevision=1,ownershipRef="ownership-1",authorized=true;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:30000,maxProviderCalls:5,randomId:()=>`dual-${++seq}`});
const requestAuthority={authorize:async()=>({authorized,principalId:"principal-1",projectId:"dual-project",ownershipRef,ownershipRevision})};
const ownership=createMovieMentorCreatorStateMutationAuthority({request:{},authorization:{authorized:true,principalId:"principal-1",projectId:"dual-project",ownershipRef,ownershipRevision},requestAuthority});
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const creators=mongoose.connection.collection("audit_dual_authority_creator");
const results=[];
try{
 await mongoose.connection.collection("movie_mentor_inference_spend_reservation").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"dual-reservation",principalId:"principal-1",projectId:"dual-project",operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 const evidence=await authority.openExecution({creatorTurnId:"dual-turn",principalId:"principal-1",projectId:"dual-project",reservationId:"dual-reservation",requestDigest:"sha256:dual",ownerId:"worker-A"});
 assert.equal(evidence.authorized,true);
 const target={projectId:"dual-project",source:"creator-decision",expectedRevision:0,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-1"};
 async function commit(){
  await assertMovieMentorCreatorStateMutationAuthority({authority:ownership,...target});
  const live=await authority.assertFence(evidence);
  if(!live.authorized)throw Object.assign(new Error("lease-fenced"),{code:"LEASE_FENCED"});
  const session=await mongoose.startSession();
  try{return await session.withTransaction(async()=>{
   const update=await executions.findOneAndUpdate({executionId:live.executionId,schema:6,phase:"active",ownerId:live.ownerId,leaseGeneration:live.leaseGeneration,leaseReference:live.leaseReference,fencingToken:live.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
   if(!update)throw Object.assign(new Error("lease-fenced"),{code:"LEASE_FENCED"});
   await creators.insertOne({projectId:target.projectId,revision:1,creatorStateFingerprint:target.creatorStateFingerprint},{session});
   return true;
  });}finally{await session.endSession();}
 }
 ownershipRevision=2;ownershipRef="ownership-2";
 let changed;try{await commit();}catch(e){changed=e;}
 assert.equal(changed?.code,"MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED");
 assert.equal((await executions.findOne({executionId:evidence.executionId})).creatorDecisionBarrierRevision,undefined);
 assert.equal(await creators.countDocuments(),0);
 results.push({case:"ownership-changed-after-admission",status:"fenced-before-write"});
 ownershipRevision=1;ownershipRef="ownership-1";authorized=false;
 let revoked;try{await commit();}catch(e){revoked=e;}
 assert.equal(revoked?.code,"MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED");
 assert.equal(await creators.countDocuments(),0);
 results.push({case:"ownership-revoked",status:"fenced-before-write"});
 authorized=true;
 assert.equal(await commit(),true);
 assert.equal((await executions.findOne({executionId:evidence.executionId})).creatorDecisionBarrierRevision,1);
 assert.equal(await creators.countDocuments(),1);
 results.push({case:"ownership-and-lease-current",status:"committed"});
 console.log(JSON.stringify({court:"dual-authority-ownership-lease-physical-design",classification:"audit-only physical design using real production ownership and lease authorities, raw execution transaction and isolated creator collection; NOT production sealed creator writer",results}));
 console.log("PASS: changed and revoked ownership cannot commit; current dual authority commits");
}finally{await mongoose.disconnect();}
