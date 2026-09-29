import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor provider-operation first-mint ↔ predispatch-refund physical race authority court");

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"physical court requires MONGO_URI");
await mongoose.connect(uri);
const db=mongoose.connection.db;

const executionId="execution-provider-operation-refund-race";
const reservationId="reservation-provider-operation-refund-race";
const principalId="creator-provider-operation-refund-race";
const projectId="project-provider-operation-refund-race";
const providerCallId="provider-call-provider-operation-refund-race";
const ownerId="worker-provider-operation-refund-race";
const leaseGeneration=1;
const leaseReference="lease-provider-operation-refund-race";
const fencingToken="fence-provider-operation-refund-race";

const executions=db.collection("movie_mentor_inference_execution");
const reservations=db.collection("movie_mentor_inference_spend_reservation");
const entitlements=db.collection("movie_mentor_inference_entitlement");
const operations=db.collection("movie_mentor_provider_operation_reality");
const effects=db.collection("movie_mentor_provider_effect_reality");

try {
  await Promise.all([
    executions.deleteMany({executionId}),
    reservations.deleteMany({reservationId}),
    entitlements.deleteMany({principalId}),
    operations.deleteMany({providerCallId}),
    effects.deleteMany({providerCallId}),
  ]);

  await operations.createIndex({providerCallId:1},{unique:true});
  await executions.createIndex({executionId:1},{unique:true});
  await reservations.createIndex({reservationId:1},{unique:true});
  await entitlements.createIndex({principalId:1},{unique:true});

  const now=new Date();
  const leaseExpiresAt=new Date(now.getTime()+10*60*1000);
  await entitlements.insertOne({principalId,domain:"iband.movie-mentor.inference-spend",schema:1,status:"active",remainingUnits:9,reservedUnits:1,consumedUnits:0,entitlementRevision:1});
  await reservations.insertOne({reservationId,principalId,projectId,units:1,entitlementRevision:1,status:"reserved"});
  await executions.insertOne({
    domain:"iband.movie-mentor.inference-execution",schema:6,executionId,reservationId,principalId,projectId,
    phase:"active",ownerId,leaseGeneration,leaseReference,fencingToken,leaseExpiresAt,
    providerCallsClaimed:1,
    providerCalls:[{providerCallId,slotId:"semantic",task:"movie-mentor-semantic",leaseGeneration,leaseReference,fencingToken}],
    providerEffectRealityRevision:0,resultCandidateBarrierRevision:0,settlementRealityBarrierRevision:0,
  });

  const operationStore=createMovieMentorProviderOperationMongoStore();
  const settlementStore=createMovieMentorInferenceSettlementMongoStore();

  const mint=operationStore.bindOperation({
    providerCallId,executionId,slotId:"semantic",task:"movie-mentor-semantic",ownerId,leaseGeneration,leaseReference,fencingToken,
    providerTarget:{provider:"openai",adapter:"openai-responses",routeFingerprint:"a".repeat(64),recoveryMode:"known-response-id-retrieval"},
    providerModel:"gpt-5.6",boundAt:new Date().toISOString(),
  });
  const release=settlementStore.releaseUnclaimedReservation({executionId,allowPredispatchClaimAbandonment:true,predispatchProviderCallId:providerCallId});

  const [mintResult,releaseResult]=await Promise.allSettled([mint,release]);
  const execution=await executions.findOne({executionId});
  const operation=await operations.findOne({providerCallId});
  const reservation=await reservations.findOne({reservationId});

  const mintCommitted=mintResult.status==="fulfilled"&&Boolean(operation);
  const releaseCommitted=releaseResult.status==="fulfilled"&&releaseResult.value?.released===true;

  assert.equal(mintCommitted&&releaseCommitted,false,
    "RED: provider-operation first mint and predispatch refund may not both commit from one admitted provider-call universe");
  if(mintCommitted){
    assert.equal(execution?.phase,"active","operation-mint winner must leave execution active");
    assert.equal(reservation?.status,"reserved","operation-mint winner must preserve reserved economic reality");
  }
  if(releaseCommitted){
    assert.equal(execution?.phase,"aborted","refund winner must durably abort execution");
    assert.equal(reservation?.status,"released","refund winner must durably release reservation");
    assert.equal(operation,null,"refund winner must leave zero durable provider-operation reality");
  }
  assert.ok(mintCommitted||releaseCommitted,
    "one side of the physical race must reach a durable authoritative outcome");

  console.log("GREEN: real Mongo execution-document serialization prevents provider-operation first mint and predispatch refund from both committing.");
  console.log("LAW: PROVIDER-OPERATION FIRST MINT AND PREDISPATCH REFUND SHARE ONE EXECUTION WRITE BARRIER; ONLY ONE DURABLE REALITY MAY WIN.");
} finally {
  await Promise.allSettled([
    executions.deleteMany({executionId}),
    reservations.deleteMany({reservationId}),
    entitlements.deleteMany({principalId}),
    operations.deleteMany({providerCallId}),
    effects.deleteMany({providerCallId}),
  ]);
  await mongoose.disconnect();
}
