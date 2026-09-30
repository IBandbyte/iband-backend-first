import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor unclaimed-release ↔ first provider-claim physical race authority court");

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"physical court requires MONGO_URI");
await mongoose.connect(uri);
const db=mongoose.connection.db;

const executionId="execution-release-claim-race";
const reservationId="reservation-release-claim-race";
const principalId="creator-release-claim-race";
const projectId="project-release-claim-race";
const creatorTurnId="turn-release-claim-race";
const providerCallId="provider-call-release-claim-race";
const ownerId="worker-release-claim-race";
const leaseGeneration=1;
const leaseReference="lease-release-claim-race";
const fencingToken="fence-release-claim-race";

const executions=db.collection("movie_mentor_inference_execution");
const reservations=db.collection("movie_mentor_inference_spend_reservation");
const entitlements=db.collection("movie_mentor_inference_entitlement");

try {
  await Promise.all([
    executions.deleteMany({executionId}),
    reservations.deleteMany({reservationId}),
    entitlements.deleteMany({principalId}),
  ]);

  await executions.createIndex({executionId:1},{unique:true});
  await executions.createIndex({principalId:1,projectId:1,creatorTurnId:1},{unique:true});
  await executions.createIndex({reservationId:1},{unique:true});
  await executions.createIndex({executionId:1,"providerCalls.slotId":1});
  await reservations.createIndex({reservationId:1},{unique:true});
  await entitlements.createIndex({principalId:1},{unique:true});

  const now=new Date();
  const leaseExpiresAt=new Date(now.getTime()+10*60*1000);
  await entitlements.insertOne({principalId,domain:"iband.movie-mentor.inference-spend",schema:1,status:"active",remainingUnits:9,reservedUnits:1,consumedUnits:0,entitlementRevision:1});
  await reservations.insertOne({reservationId,principalId,projectId,operation:"movie-mentor-turn",units:1,entitlementRevision:1,status:"reserved"});
  await executions.insertOne({
domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId,creatorTurnId,principalId,projectId,reservationId,
    requestDigest:"a".repeat(64),phase:"active",ownerId,leaseGeneration,leaseReference,fencingToken,
    leaseAcquiredAt:now,leaseExpiresAt,maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],
    abandonedPredispatchProviderCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,
    resultFinalizationBarrierRevision:0,resultCandidateBarrierRevision:0,closureReference:"",
    frozenProviderCallCount:null,frozenProviderCallSetDigest:"",closingAt:null,closedFromExecutionGeneration:null,
    closurePolicyVersion:"",closureCertificateDigest:"",closedAt:null,finalizedResultReference:"",
    finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",
    settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",
    compensatedAt:null,compensationReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:"",
  });

  const executionStore=createMovieMentorInferenceExecutionMongoStore();
  const settlementStore=createMovieMentorInferenceSettlementMongoStore();

  // Warm the real stores so lazy connection/index readiness is outside the defendant race.
  await executionStore.readExecution(executionId);
  await settlementStore.releaseUnclaimedReservation({executionId:"readiness-probe-missing-execution"}).catch(()=>null);

  const claim=executionStore.claimProviderCall({
    executionId,ownerId,leaseGeneration,leaseReference,fencingToken,providerCallId,
    slotId:"semantic",task:"movie-mentor-semantic",admittedAt:new Date().toISOString(),
  });
  const release=settlementStore.releaseUnclaimedReservation({executionId});

  const [claimResult,releaseResult]=await Promise.allSettled([claim,release]);
  const execution=await executions.findOne({executionId});
  const reservation=await reservations.findOne({reservationId});
  const entitlement=await entitlements.findOne({principalId});

  const claimCommitted=claimResult.status==="fulfilled"&&claimResult.value?.claimed===true;
  const releaseCommitted=releaseResult.status==="fulfilled"&&releaseResult.value?.released===true;

  assert.equal(claimCommitted&&releaseCommitted,false,
    "RED: first provider claim and zero-claim release may not both commit from one active execution");
  if(claimCommitted){
    assert.equal(execution?.phase,"active","provider-claim winner must leave execution active");
    assert.equal(execution?.providerCallsClaimed,1,"provider-claim winner must durably own exactly one claim");
    assert.equal(reservation?.status,"reserved","provider-claim winner must preserve reserved economic reality");
    assert.equal(entitlement?.remainingUnits,9,"provider-claim winner must not restore creator credit");
    assert.equal(entitlement?.reservedUnits,1,"provider-claim winner must preserve reserved units");
  }
  if(releaseCommitted){
    assert.equal(execution?.phase,"aborted","release winner must durably abort execution");
    assert.equal(execution?.providerCallsClaimed,0,"release winner must preserve zero provider claims");
    assert.equal(reservation?.status,"released","release winner must durably release reservation");
    assert.equal(entitlement?.remainingUnits,10,"release winner must restore creator credit exactly once");
    assert.equal(entitlement?.reservedUnits,0,"release winner must clear reserved units exactly once");
  }
  assert.ok(claimCommitted||releaseCommitted,
    "one side of the physical race must reach a durable authoritative outcome");

  console.log("GREEN: real Mongo execution-document serialization prevents first provider claim and zero-claim release from both committing.");
  console.log("LAW: FIRST PROVIDER CLAIM AND ZERO-CLAIM RELEASE SHARE ONE EXECUTION WRITE BARRIER; ONLY CLAIMED-RESERVED OR ABORTED-RELEASED MAY WIN.");
} finally {
  await Promise.allSettled([
    executions.deleteMany({executionId}),
    reservations.deleteMany({reservationId}),
    entitlements.deleteMany({principalId}),
  ]);
  await mongoose.disconnect();
}
