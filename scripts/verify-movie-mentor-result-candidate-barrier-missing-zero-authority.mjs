import assert from "node:assert/strict";
import mongoose from "mongoose";
process.env.MONGO_URI=process.env.MONGO_URI||"mongodb://127.0.0.1:27017/movie_mentor_candidate_barrier_missing_zero";
const {createMovieMentorInferenceExecutionMongoStore}=await import("../ai/MovieMentorInferenceExecutionMongoStore.js");
await mongoose.connect(process.env.MONGO_URI);
const col=mongoose.connection.db.collection("candidate_barrier_rows");
const schema=new mongoose.Schema({}, {strict:false,collection:"candidate_barrier_rows"});
const Model=mongoose.models.CandidateBarrierMissingZeroCourt||mongoose.model("CandidateBarrierMissingZeroCourt",schema);
const row={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-candidate-zero",creatorTurnId:"turn-candidate-zero",principalId:"creator",projectId:"project",reservationId:"reservation-candidate-zero",requestDigest:"request",phase:"active",ownerId:"owner",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseAcquiredAt:new Date("2032-01-01T00:00:00Z"),leaseExpiresAt:new Date("2032-01-01T00:10:00Z"),maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,closureReference:"",frozenProviderCallCount:null,frozenProviderCallSetDigest:"",closingAt:null,closedFromExecutionGeneration:null,closurePolicyVersion:"",closureCertificateDigest:"",closedAt:null,finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",compensatedAt:null,compensationReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:""};
await col.insertOne(row); // resultCandidateBarrierRevision deliberately physically absent
const store=createMovieMentorInferenceExecutionMongoStore({mongoModel:Model});
const current=await store.readExecution(row.executionId);
assert.equal(current.resultCandidateBarrierRevision,0);
const next={...current,leaseExpiresAt:"2032-01-01T00:20:00.000Z"};
const renewed=await store.replaceExecution(next,{expectedPhase:"active",expectedLeaseGeneration:1,expectedLeaseReference:"lease-1",expectedLeaseExpiresAt:"2032-01-01T00:10:00.000Z"});
assert.ok(renewed,"normalized historical zero candidate barrier must not block legitimate same-generation replacement");
assert.equal(renewed.leaseExpiresAt,"2032-01-01T00:20:00.000Z");
console.log("LAW: PHYSICALLY MISSING HISTORICAL RESULT-CANDIDATE BARRIER ZERO MUST REMAIN CAS-COMPATIBLE WITH NORMALIZED ZERO.");
await mongoose.disconnect();
