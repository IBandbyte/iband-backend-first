import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {writeAuthoritativeCreatorState,readAuthoritativeTurnSource} from "../ai/MovieMentorCreatorStateStore.js";
import {createMovieMentorCreatorStateMutationAuthority} from "../ai/MovieMentorCreatorStateMutationAuthority.js";
assert.equal(process.env.MONGO_URI,"mongodb://127.0.0.1:27017/iband_real_writer_initial_create_session_court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
try{
 const store=createMovieMentorInferenceExecutionMongoStore();
 let n=0;
 const lease=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:30000,maxProviderCalls:5,randomId:()=>`seam-${++n}`});
 const projectId="real-writer-transaction-seam",principalId="seam-owner",reservationId="seam-reservation";
 const reservations=mongoose.connection.collection("movie_mentor_inference_spend_reservation");
 const creators=mongoose.connection.collection("movie_mentor_creator_state");
 const executions=mongoose.connection.collection("movie_mentor_inference_execution");
 await creators.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await reservations.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId,projectId,operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 const evidence=await lease.openExecution({creatorTurnId:"seam-turn",principalId,projectId,reservationId,requestDigest:"sha256:seam",ownerId:"worker-A"});
 assert.equal((await lease.assertFence(evidence)).authorized,true);
 const next={projectId,creatorSessionId:"seam-session",revision:1,revisionAuthorityReference:"revision-1",creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-1",creatorAuthorityReference:"authority-1",snapshotReference:"snapshot-1",creatorConfirmedContext:[],compensationBarrierRevision:0,capturedAt:new Date().toISOString(),transition:{source:"creator-decision"}};
 const authorization={authorized:true,principalId,projectId,ownershipRef:"seam-owner-reference",ownershipRevision:1};
 const mutationAuthority=createMovieMentorCreatorStateMutationAuthority({request:{court:true},authorization,requestAuthority:{async authorize(){return authorization;}}});
 let callbackObserved=false;
 const session=await mongoose.startSession();
 try{
  let aborted=false;
  try{
   await session.withTransaction(async()=>{
    const fence=await executions.findOneAndUpdate({executionId:evidence.executionId,schema:6,phase:"active",ownerId:evidence.ownerId,leaseGeneration:evidence.leaseGeneration,leaseReference:evidence.leaseReference,fencingToken:evidence.fencingToken,$or:[{creatorDecisionBarrierRevision:0},{creatorDecisionBarrierRevision:{$exists:false}}],$expr:{$gt:["$leaseExpiresAt","$$NOW"]}},{$set:{creatorDecisionBarrierRevision:1}},{session,returnDocument:"after"});
    assert.ok(fence);
    await writeAuthoritativeCreatorState(next,{expectedRevision:0,creatorStateMutationAuthority:mutationAuthority,session});
    callbackObserved=true;
    throw Object.assign(new Error("intentional-rollback"),{code:"INTENTIONAL_ROLLBACK"});
   });
  }catch(e){assert.equal(e.code,"INTENTIONAL_ROLLBACK");aborted=true;}
  assert.equal(aborted,true);
  assert.equal(callbackObserved,true);
 }finally{await session.endSession();}
 const durable=await creators.findOne({projectId});
 const execution=await executions.findOne({executionId:evidence.executionId});
 const creatorRolledBack=durable===null;
 const executionRolledBack=execution.creatorDecisionBarrierRevision===undefined;
 console.log(JSON.stringify({court:"real-creator-writer-initial-create-session-seam",classification:"audit-only deliberate transaction rollback with genuine lease and production creator-state writer; injected session option probes whether writer actually joins transaction; NOT production repair",creatorRolledBack,executionRolledBack,creatorRevision:durable?.revision??null,executionBarrier:execution.creatorDecisionBarrierRevision??null}));
 assert.equal(executionRolledBack,true,"execution barrier must roll back");
 assert.equal(creatorRolledBack,true,"PHYSICAL RED: production creator-state writer must join the same MongoDB session as execution barrier");
 console.log("PASS: production creator-state writer and execution barrier rolled back atomically");
}finally{await mongoose.disconnect();}
