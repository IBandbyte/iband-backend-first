import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const uri=process.env.MONGO_URI;assert.ok(uri);await mongoose.connect(uri);
const db=mongoose.connection.db,executions=db.collection("movie_mentor_inference_execution"),reservations=db.collection("movie_mentor_inference_spend_reservation");
await executions.deleteMany({});await reservations.deleteMany({});
const now=new Date((await db.command({hello:1})).localTime),expiry=new Date(now.getTime()+60000);
const row={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-post-candidate",creatorTurnId:"turn-post-candidate",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"digest-1",phase:"active",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseAcquiredAt:new Date(now.getTime()-1000),leaseExpiresAt:expiry,maxProviderCalls:2,providerCallsClaimed:1,providerCalls:[{providerCallId:"call-1",slotId:"semantic",task:"movie-mentor-semantic",state:"admitted",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",admittedAt:new Date(now.getTime()-500)}],abandonedPredispatchProviderCalls:[],providerEffectRealityRevision:1,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,resultCandidateBarrierRevision:1,closureReference:"",frozenProviderCallCount:null,frozenProviderCallSetDigest:"",closingAt:null,closedFromExecutionGeneration:null,closurePolicyVersion:"",closureCertificateDigest:"",closedAt:null,finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",compensatedAt:null,compensationReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:""};
await executions.insertOne(row);
const model={findOne:q=>({lean(){return this},exec:async()=>executions.findOne(q)}),findOneAndUpdate:(q,u)=>({lean(){return this},exec:async()=>{const r=await executions.findOneAndUpdate(q,u,{returnDocument:"after"});return r;}})};
const store=createMovieMentorInferenceExecutionMongoStore({mongoModel:model,reservationCollection:false});
const result=await store.claimProviderCall({executionId:row.executionId,ownerId:row.ownerId,leaseGeneration:1,leaseReference:row.leaseReference,fencingToken:row.fencingToken,providerCallId:"call-2",slotId:"story",task:"movie-mentor-story",admittedAt:now});
assert.equal(result.claimed,false,"result-candidate barrier must freeze the provider-call universe; no new provider slot may be admitted after candidate staging");
const durable=await executions.findOne({executionId:row.executionId});
assert.equal(durable.providerCallsClaimed,1);
assert.equal(durable.providerCalls.length,1);
console.log("LAW: RESULT-CANDIDATE STAGING FREEZES THE PROVIDER-CALL UNIVERSE; POST-CANDIDATE CLAIMS MUST ACQUIRE ZERO AUTHORITY.");
await mongoose.disconnect();