import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { createMovieMentorInferenceExecutionClosureAuthority } from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//);
assert.match(uri,/replicaSet=/);
process.env.MONGO_URI=uri;
const suffix=`settlement-denial-${process.pid}-${Date.now()}`;
const principalId=`${suffix}-owner`,projectId=`${suffix}-project`;
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 const entitlements=db.collection("movie_mentor_inference_entitlement");
 await entitlements.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"active",remainingUnits:1,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 const spend=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(spend.ready,true);
 const reservation=await spend.authority.reserveTurn({serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},projectId,units:1});
 assert.equal(reservation.authorized,true);
 const settlement=createMovieMentorInferenceSettlementMongoStore();
 const reservationCollection=db.collection("movie_mentor_inference_spend_reservation");
 const beforeEntitlement=await entitlements.findOne({principalId});
 const beforeReservation=await reservationCollection.findOne({principalId});
 assert.equal(beforeEntitlement.remainingUnits,0);
 assert.equal(beforeEntitlement.reservedUnits,1);
 assert.equal(beforeEntitlement.consumedUnits,0);
 assert.equal(beforeReservation.status,"reserved");
 const missing=await settlement.settleCanonicalResult({executionId:`${suffix}-nonexistent-execution`});
 assert.equal(missing.authorized,false);
 assert.equal(missing.settled,false);
 assert.equal(missing.reason,"execution-not-found");
 assert.deepEqual(await entitlements.findOne({principalId}),beforeEntitlement);
 assert.deepEqual(await reservationCollection.findOne({principalId}),beforeReservation);
 const executionId=`${suffix}-real-active-execution`;
 const now=new Date();
 const created=await createMovieMentorInferenceExecutionMongoStore().createExecution({
  executionId,creatorTurnId:`${suffix}-turn`,principalId,projectId,
  reservationId:beforeReservation.reservationId,requestDigest:`${suffix}-digest`,
  phase:"active",ownerId:`${suffix}-worker`,leaseGeneration:1,
  leaseReference:`${suffix}-lease`,fencingToken:`${suffix}-fence`,
  leaseAcquiredAt:now,leaseExpiresAt:new Date(now.getTime()+120000),
  maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[]
 });
 assert.equal(created.schema,6);
 const boundReservation=await reservationCollection.findOne({principalId});
 assert.equal(boundReservation.executionBindingBarrierRevision,1,"real execution creation must advance the durable reservation binding barrier");
 assert.equal(boundReservation.status,"reserved");
 const active=await settlement.settleCanonicalResult({executionId});
 assert.equal(active.authorized,false);
 assert.equal(active.settled,false);
 assert.equal(active.reason,"execution-not-finalized");
 assert.deepEqual(await entitlements.findOne({principalId}),beforeEntitlement);
 assert.deepEqual(await reservationCollection.findOne({principalId}),boundReservation);
 const candidates=db.collection("movie_mentor_result_candidate");
 await candidates.createIndex({executionId:1},{unique:true});
 await candidates.createIndex({candidateReference:1},{unique:true});
 const creatorState=db.collection("movie_mentor_creator_state");
 await creatorState.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 const executionCollection=db.collection("movie_mentor_inference_execution");
 await executionCollection.createIndex({executionId:1},{unique:true});
 const candidateStore=createMovieMentorResultCandidateMongoStore();
 const liveExecution={authorized:true,executionAuthorized:true,executionId,creatorTurnId:created.creatorTurnId,
  principalId,projectId,reservationId:beforeReservation.reservationId,requestDigest:created.requestDigest,
  ownerId:created.ownerId,leaseGeneration:created.leaseGeneration,leaseReference:created.leaseReference,
  fencingToken:created.fencingToken};
 await assert.rejects(
  ()=>candidateStore.stageCandidate({execution:liveExecution,resultPayload:{status:"complete"}}),
  error=>error?.code==="MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_PROOF_REQUIRED"
 );
 assert.equal(await candidates.countDocuments({executionId}),0);
 assert.deepEqual(await reservationCollection.findOne({principalId}),boundReservation);
 console.log("GREEN physical candidate mint denies missing creator-state consumption proof without ledger mutation");
 const closure=createMovieMentorInferenceExecutionClosureAuthority({
  store:createMovieMentorInferenceExecutionMongoStore(),
  effectStore:createMovieMentorProviderEffectMongoStore()
 });
 const closing=await closure.beginClosing({execution:{
  authorized:true,executionId,ownerId:created.ownerId,
  leaseGeneration:created.leaseGeneration,leaseReference:created.leaseReference,
  fencingToken:created.fencingToken
 }});
 assert.equal(closing.authorized,true);
 assert.equal(closing.phase,"closing");
 const closed=await closure.reconcile({executionId});
 assert.equal(closed.authorized,true);
 assert.equal(closed.closed,true);
 assert.equal(closed.phase,"closed");
 const afterClosureReservation=await reservationCollection.findOne({principalId});
 const afterClosureEntitlement=await entitlements.findOne({principalId});
 const premature=await settlement.settleCanonicalResult({executionId});
 assert.equal(premature.authorized,false);
 assert.equal(premature.settled,false);
 assert.equal(premature.reason,"execution-not-finalized");
 assert.deepEqual(await reservationCollection.findOne({principalId}),afterClosureReservation);
 assert.deepEqual(await entitlements.findOne({principalId}),afterClosureEntitlement);
 console.log("GREEN real closure authority closes zero-call execution; settlement refuses absent canonical finalization");
 console.log("GREEN production Mongo settlement refuses real schema-6 active execution before finalization");
 console.log("GREEN production Mongo settlement rejects nonexistent execution without consuming reserved spend");
 console.log("LIMITATION: negative settlement gate only; real finalized execution/canonical result/settled replay remains uncertified.");
}finally{await mongoose.disconnect();}
