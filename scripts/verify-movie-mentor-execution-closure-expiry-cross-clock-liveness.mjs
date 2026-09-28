import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"MONGO_URI required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const c=mongoose.connection.collection("movie_mentor_inference_execution");
await c.deleteMany({});
const serverNow=(await mongoose.connection.db.command({hello:1})).localTime;
const laggingProcessNow=new Date(serverNow.getTime()-120000);
const leaseExpiresAt=new Date(serverNow.getTime()-1000);
const leaseAcquiredAt=new Date(serverNow.getTime()-60000);
await c.insertOne({
 domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-cross-clock",
 creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",
 requestDigest:"digest-1",phase:"active",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",
 fencingToken:"fence-1",leaseAcquiredAt,leaseExpiresAt,maxProviderCalls:5,providerCallsClaimed:0,providerCalls:[],
 abandonedPredispatchProviderCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,
 resultFinalizationBarrierRevision:0,resultCandidateBarrierRevision:0
});
assert.ok(leaseExpiresAt<=serverNow,"fixture must be expired by authoritative Mongo time");
assert.ok(leaseExpiresAt>laggingProcessNow,"fixture must still appear live to lagging process time");
const store=createMovieMentorInferenceExecutionMongoStore();
console.log("execution closure expiry cross-clock liveness");
const recovered=await store.recoverExpiredIntoClosing({
 executionId:"execution-cross-clock",closureReference:"closure-1",frozenProviderCallCount:0,
 frozenProviderCallSetDigest:"digest-empty",closingAt:laggingProcessNow.toISOString(),
 closurePolicyVersion:"cross-clock-court",requireDurablyExpired:true
});
assert.equal(recovered?.phase,"closing","Mongo-authoritatively expired execution must not remain stranded ACTIVE because process clock lags");
assert.equal(recovered?.closureReference,"closure-1");
console.log("LAW: Mongo server expiry owns expired-execution recovery eligibility; a lagging process clock may not veto durable recovery.");
await mongoose.disconnect();
