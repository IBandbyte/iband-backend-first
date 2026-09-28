import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"MONGO_URI required");
process.env.MONGO_URI=uri;
const store=createMovieMentorInferenceExecutionMongoStore();
await store.readExecution("court-readiness-probe");
const db=mongoose.connection.db;
const collection=db.collection("movie_mentor_inference_execution");
await collection.deleteMany({});
const hello=await db.command({hello:1});
const serverNow=new Date(hello.localTime);
const laggingNow=new Date(serverNow.getTime()-120000);
const leaseExpiresAt=new Date(serverNow.getTime()-1000);
const leaseAcquiredAt=new Date(serverNow.getTime()-60000);
assert.ok(leaseExpiresAt.getTime()<=serverNow.getTime());
assert.ok(leaseExpiresAt.getTime()>laggingNow.getTime());
await collection.insertOne({
 domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-live-clock",creatorTurnId:"turn-live-clock",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"digest-1",
 phase:"active",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseAcquiredAt,leaseExpiresAt,maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],
 providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,resultCandidateBarrierRevision:0
});
const written=await store.beginClosing({
 executionId:"execution-live-clock",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",
 closureReference:"closure-live-clock",frozenProviderCallCount:0,frozenProviderCallSetDigest:"frozen-live-clock",closingAt:laggingNow.toISOString(),closurePolicyVersion:"court"
});
assert.equal(written.phase,"active","Mongo-expired execution lease must not acquire live CLOSING authority through a lagging process clock");
console.log("LAW: MONGO SERVER TIME OWNS LIVE-LEASE VALIDITY AT IRREVERSIBLE CLOSURE ENTRY; PROCESS CLOCK SKEW MAY NOT REVIVE AN EXPIRED FENCE.");
console.log("live closure entry cross-clock authority: GREEN");
await mongoose.disconnect();
