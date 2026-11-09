import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";
import { createMovieMentorCanonicalResultAuthority } from "../ai/MovieMentorCanonicalResultAuthority.js";
import { createMovieMentorCreatorStateConsumptionAuthority } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
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
 const stateRevision=0,stateGeneration=1,stateFingerprint=`${suffix}-state-fingerprint`;
 await creatorState.insertOne({projectId,revision:stateRevision,creatorStateGeneration:stateGeneration,creatorStateFingerprint:stateFingerprint});
 const ownershipRef=`${suffix}-ownership-ref`;
 const authorization={authorized:true,principalId,projectId,ownershipRef,ownershipRevision:1};
 const consumption=createMovieMentorCreatorStateConsumptionAuthority({
  request:{headers:{authorization:"isolated-fixture"}},
  authorization,
  requestAuthority:{authorize:async()=>authorization}
 });
 const stateProof=await consumption.assertCurrentConsumption({
  projectId,stage:"result-candidate",revision:stateRevision,
  creatorStateGeneration:stateGeneration,creatorStateFingerprint:stateFingerprint,executionId
 });
 const staged=await candidateStore.stageCandidate({
  execution:liveExecution,resultPayload:{status:"complete"},
  creatorStateConsumptionProof:stateProof
 });
 assert.equal(staged.executionId,executionId);
 assert.equal(await candidates.countDocuments({executionId}),1);
 const stateAfter=await creatorState.findOne({projectId});
 assert.equal(stateAfter.resultCandidateBarrierRevision,1);
 const executionAfter=await executionCollection.findOne({executionId});
 assert.equal(executionAfter.resultCandidateBarrierRevision,1);
 assert.deepEqual(await reservationCollection.findOne({principalId}),boundReservation);
 console.log("GREEN physical candidate mint with creator-state proof: atomic creator-state and execution write barriers");
 console.log("LIMITATION: isolated seeded creator-state ledger and synthetic current-ownership adapter; full authenticated state provenance not certified.");
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
 const results=db.collection("movie_mentor_canonical_result");
 await results.createIndex({executionId:1},{unique:true});
 await results.createIndex({resultReference:1},{unique:true});
 await results.createIndex({creatorTurnId:1,principalId:1,projectId:1},{unique:true});
 const canonical=createMovieMentorCanonicalResultAuthority({
  store:createMovieMentorCanonicalResultMongoStore(),
  assertCurrentClosure:closure.assertCurrentClosure,
  readResultCandidate:candidateStore.readByExecution
 });
 const payload={status:"complete"};
 const committed=await canonical.commitResult({closure:closed,result:payload});
 assert.equal(committed.authorized,true);
 assert.equal(committed.committed,true);
 assert.equal(committed.executionPhase,"finalized");
 assert.equal(await results.countDocuments({executionId}),1);
 const finalized=await settlement.settleCanonicalResult({executionId});
 assert.equal(finalized.authorized,true);
 assert.equal(finalized.settled,true);
 const settledReservation=await reservationCollection.findOne({principalId});
 const settledEntitlement=await entitlements.findOne({principalId});
 assert.equal(settledReservation.status,"consumed");
 assert.equal(settledEntitlement.reservedUnits,0);
 assert.equal(settledEntitlement.consumedUnits,1);
 const repeated=await settlement.settleCanonicalResult({executionId});
 assert.equal(repeated.authorized,true);
 assert.equal(repeated.settled,true);
 assert.deepEqual(await reservationCollection.findOne({principalId}),settledReservation);
 assert.deepEqual(await entitlements.findOne({principalId}),settledEntitlement);
 assert.equal(await results.countDocuments({executionId}),1);
 console.log("GREEN physical canonical finalization and exactly-once Mongo spend settlement with repeated replay");
 console.log("LIMITATION: isolated creator-state and synthetic ownership fixtures; authenticated complete HTTP turn/restart replay not certified.");
 console.log("GREEN real closure authority closes zero-call execution; settlement refuses absent canonical finalization");
 console.log("GREEN production Mongo settlement refuses real schema-6 active execution before finalization");
 console.log("GREEN production Mongo settlement rejects nonexistent execution without consuming reserved spend");
 console.log("LIMITATION: negative settlement gate only; real finalized execution/canonical result/settled replay remains uncertified.");
}finally{await mongoose.disconnect();}
