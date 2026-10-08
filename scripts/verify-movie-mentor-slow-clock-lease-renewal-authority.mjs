import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

assert.ok(process.env.MONGO_URI,"MONGO_URI required for physical MongoDB court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
try {
 const collection=mongoose.connection.db.collection("movie_mentor_inference_execution");
 await collection.deleteMany({});
 const slowClock=()=>new Date(Date.now()-90_000);
 const expiry=new Date(Date.now()-30_000);
 const acquired=new Date(expiry.getTime()-60_000);
 const executionId="execution-slow-clock-renewal";
 // Seed a valid physical execution as existing Mongo lease courts do. This avoids
 // unrelated transactional creation requirements on the standalone Mongo service.
 await collection.insertOne({
  domain:"iband.movie-mentor.inference-execution-store",schema:6,
  executionId,creatorTurnId:"turn-slow-clock-renewal",
  principalId:"principal-slow-clock",projectId:"project-slow-clock",
  reservationId:"reservation-slow-clock",requestDigest:"digest-slow-clock",
  phase:"active",ownerId:"owner-slow-clock",leaseGeneration:1,
  leaseReference:"lease-slow-clock",fencingToken:"fence-slow-clock",
  leaseAcquiredAt:acquired,leaseExpiresAt:expiry,
  maxProviderCalls:5,providerCallsClaimed:0,providerCalls:[],
  abandonedPredispatchProviderCalls:[],providerEffectRealityRevision:0,
  settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,
  resultCandidateBarrierRevision:0,closureReference:"",
  frozenProviderCallCount:null,frozenProviderCallSetDigest:"",
  closingAt:null,closedFromExecutionGeneration:null,closurePolicyVersion:"",
  closureCertificateDigest:"",closedAt:null,
  finalizedResultReference:"",finalizedCandidateReference:"",
  finalizedResultDigest:"",resultFinalizedAt:null,
  settledResultReference:"",settledCandidateReference:"",
  settledResultDigest:"",settledAt:null,
  abortedAt:null,abortReason:"",compensatedAt:null,
  compensationReason:"",quarantinedAt:null,quarantineReason:"",
  quarantinedFromPhase:"",
 });
 const authority=createMovieMentorInferenceExecutionLeaseAuthority({
  store:createMovieMentorInferenceExecutionMongoStore(),
  now:slowClock,leaseMs:60_000,maxProviderCalls:5,
  randomId:(()=>{let id=0;return()=>`slow-clock-court-${++id}`;})(),
 });
 // Acquire through production authority to mint genuine WeakSet owner proof.
 const owned=await authority.acquireExecution({executionId,ownerId:"owner-slow-clock"});
 assert.equal(owned.authorized,true,"court requires real authority-issued ownership proof");
 const before=await collection.findOne({executionId});
 assert.equal(before.schema,6,"court requires current production schema");
 assert.equal(before.leaseGeneration,1,"court must retain generation-one ownership");
 assert.ok(new Date(before.leaseExpiresAt).getTime()>slowClock().getTime(),
  "slow worker must consider its own lease live");
 const expired=await collection.countDocuments({
  executionId,$expr:{$lte:["$leaseExpiresAt","$$NOW"]},
 });
 assert.equal(expired,1,"MongoDB must already consider the lease expired before renewal");
 const renewed=await authority.renewExecution(owned);
 const after=await collection.findOne({executionId});
 assert.equal(renewed.authorized,false,
  "RED: slow-clock worker renewed an already MongoDB-expired lease and minted fresh ownership evidence");
 assert.equal(new Date(after.leaseExpiresAt).getTime(),new Date(before.leaseExpiresAt).getTime(),
  "RED: slow-clock renewal extended a lease already expired by MongoDB server time");
 assert.equal(after.leaseGeneration,1);
 console.log("GREEN: MongoDB-expired execution cannot be renewed by a slow-clock worker.");
 console.log("LAW: DURABLE MONGODB TIME, NOT PROCESS-LOCAL TIME, GOVERNS LEASE RENEWAL.");
} finally {
 await mongoose.disconnect();
}
