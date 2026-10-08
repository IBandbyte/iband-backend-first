import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {createMovieMentorCreatorStateMutationAuthority,assertMovieMentorCreatorStateMutationAuthority} from "../ai/MovieMentorCreatorStateMutationAuthority.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_ownership_postcheck_race_court");
await mongoose.connect(process.env.MONGO_URI);
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const lease=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:30000,maxProviderCalls:5,randomId:()=>`race-${++seq}`});
const executions=mongoose.connection.collection("movie_mentor_inference_execution");
const creators=mongoose.connection.collection("audit_postcheck_creator");
let ownerRevision=1,ownerRef="owner-ref-1",authorized=true,authorizeCalls=0;
const requestAuthority={authorize:async()=>{authorizeCalls++;return {authorized,principalId:"owner-1",projectId:"postcheck-project",ownershipRef:ownerRef,ownershipRevision:ownerRevision};}};
const ownership=createMovieMentorCreatorStateMutationAuthority({request:{},authorization:{authorized:true,principalId:"owner-1",projectId:"postcheck-project",ownershipRef:"owner-ref-1",ownershipRevision:1},requestAuthority});
try{
 await mongoose.connection.collection("movie_mentor_inference_spend_reservation").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"postcheck-reservation",principalId:"owner-1",projectId:"postcheck-project",operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 const evidence=await lease.openExecution({creatorTurnId:"postcheck-turn",principalId:"owner-1",projectId:"postcheck-project",reservationId:"postcheck-reservation",requestDigest:"sha256:postcheck",ownerId:"worker-A"});
 assert.equal(evidence.authorized,true);
 const target={projectId:"postcheck-project",source:"creator-decision",expectedRevision:0,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-postcheck"};
 await assertMovieMentorCreatorStateMutationAuthority({authority:ownership,...target});
 const admitted=await lease.assertFence(evidence);
 assert.equal(admitted.authorized,true);
 const callsAtAdmission=authorizeCalls;
 // Deliberately mutate the simulated external ownership authority AFTER both preflight checks.
 ownerRevision=2;ownerRef="owner-ref-2";authorized=false;
 const session=await mongoose.startSession();
 try{await session.withTransaction(async()=>{
  const barrier=await executions.findOneAndUpdate({executionId:admitted.executionId,schema:6,phase:"active",ownerId:admitted.ownerId,leaseGeneration:admitted.leaseGeneration,leaseReference:admitted.leaseReference,fencingToken:admitted.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
  assert.ok(barrier);
  await creators.insertOne({projectId:target.projectId,revision:1},{session});
 });}finally{await session.endSession();}
 const physicalBarrier=(await executions.findOne({executionId:evidence.executionId})).creatorDecisionBarrierRevision;
 const creatorRevision=(await creators.findOne({projectId:target.projectId})).revision;
 assert.equal(physicalBarrier,1);
 assert.equal(creatorRevision,1);
 assert.equal(authorizeCalls,callsAtAdmission,"Transaction did not reread external ownership");
 let after;try{await assertMovieMentorCreatorStateMutationAuthority({authority:ownership,...target});}catch(e){after=e;}
 assert.equal(after?.code,"MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED");
 console.log(JSON.stringify({court:"postcheck-ownership-race-characterization",classification:"audit-only deliberately staged external-ownership change between preflight and MongoDB transaction; fixture proves check-to-commit gap, NOT production-reachable exploit or repair",ownerAtPreflight:"authorized",ownerAtCommit:"revoked",barrierCommitted:physicalBarrier,creatorRevisionCommitted:creatorRevision,authorizationRecheckedInsideTransaction:false,postCommitOwnershipCheck:after.code}));
 console.log("PASS: staged post-check ownership revocation remains invisible to isolated Mongo transaction; physical design gap characterized");
}finally{await mongoose.disconnect();}
