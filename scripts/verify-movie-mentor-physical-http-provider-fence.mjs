import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import {createServer} from "node:http";
import {once} from "node:events";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {buildRequestDigest} from "../ai/MovieMentorTurnRuntime.js";
import {runMovieMentorTurnWithForwardExecutionAuthority} from "../ai/MovieMentorForwardExecutionRuntime.js";
import {createMovieMentorProductionInferenceSpendComposition} from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import {createMovieMentorProductionInferenceExecutionComposition,isMovieMentorProductionInferenceExecutionOwnerProof} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import {createMovieMentorProductionInferenceSettlementComposition,isMovieMentorProductionInferenceSettlementOwnerProof} from "../ai/MovieMentorProductionInferenceSettlementComposition.js";
import {MOVIE_MENTOR_INFERENCE_SPEND_DOMAIN as DOMAIN,MOVIE_MENTOR_INFERENCE_SPEND_SCHEMA as SCHEMA,MOVIE_MENTOR_INFERENCE_ENTITLEMENT_COLLECTION as ENTITLEMENTS,MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_COLLECTION as RESERVATIONS} from "../ai/MovieMentorInferenceSpendMongoStore.js";
import {MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES as SETTLEMENT_REQUIRED} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";
import {MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES as REQUIRED} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";

// Positive reservation -> execution -> identity convergence. No provider or settlement certification.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri),"Disposable localhost Mongo required");
process.env.MONGO_URI=uri;
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 await db.collection(ENTITLEMENTS).createIndex({principalId:1},{unique:true});
 await db.collection(RESERVATIONS).createIndex({reservationId:1},{unique:true});
 for(const requirement of [...REQUIRED,...SETTLEMENT_REQUIRED])await db.collection(requirement.collection).createIndex(requirement.key,{unique:true});
 await db.collection("movie_mentor_provider_operation_reality").createIndex({providerCallId:1},{unique:true});
 // Independent physical CAS court: competing immutable reconstruction inputs cannot replace first durable winner.
 const {createMovieMentorProviderOperationMongoStore}=await import("../ai/MovieMentorProviderOperationMongoStore.js");
 const {describeCurrentMovieMentorProviderTarget}=await import("../ai/MovieMentorProviderTargetAuthority.js");
 const operationStore=createMovieMentorProviderOperationMongoStore();
 const raceId="isolated-reconstruction-race-"+Date.now();
 const raceIdentity={providerCallId:raceId,executionId:raceId+"-execution",slotId:"semantic",task:"movie-mentor-semantic"};
 await operationStore.bindOperation({...raceIdentity,providerTarget:describeCurrentMovieMentorProviderTarget(),providerModel:process.env.IBAND_AI_MODEL,boundAt:new Date().toISOString()});
 const contenders=Array.from({length:8},(_,i)=>({ ...raceIdentity,reconstructionInputDigest:"isolated-digest-"+i,reconstructionInput:{contender:i},boundAt:new Date().toISOString()}));
 const outcomes=await Promise.allSettled(contenders.map(input=>operationStore.bindReconstructionInput(input)));
 assert.ok(outcomes.some(outcome=>outcome.status==="fulfilled"),"at least one reconstruction contender must bind");
 const persisted=await operationStore.readOperation(raceId);
 assert.ok(persisted.reconstructionInputDigest,"winning reconstruction digest must be durable");
 const winner=contenders.find(input=>input.reconstructionInputDigest===persisted.reconstructionInputDigest);
 assert.ok(winner,"durable winner must be one submitted contender");
 assert.deepEqual(persisted.reconstructionInput,winner.reconstructionInput,"digest and reconstruction payload must belong to same winner");
 assert.ok(outcomes.every(outcome=>outcome.status==="rejected"||(outcome.value.reconstructionInputDigest===persisted.reconstructionInputDigest&&JSON.stringify(outcome.value.reconstructionInput)===JSON.stringify(winner.reconstructionInput))),"every successful contender must observe the one durable winner");
 const conflicting=contenders.find(input=>input.reconstructionInputDigest!==persisted.reconstructionInputDigest);
 await assert.rejects(()=>operationStore.bindReconstructionInput(conflicting),error=>error?.code==="MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_CONFLICT","conflicting replay must be denied rather than silently returning the first durable input");
 await assert.rejects(()=>operationStore.bindReconstructionInput({...winner,reconstructionInput:{contender:"tampered-payload"}}),error=>error?.code==="MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_CONFLICT","reusing the winning digest with altered payload must be denied");
 await assert.rejects(()=>operationStore.bindReconstructionInput({...winner,reconstructionInputDigest:"forged-digest"}),error=>error?.code==="MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_CONFLICT","reusing the winning payload with altered digest must be denied");
 const identical=await operationStore.bindReconstructionInput(winner);
 assert.equal(identical.reconstructionInputDigest,persisted.reconstructionInputDigest,"identical replay must remain idempotent");
 const afterConflict=await operationStore.readOperation(raceId);
 assert.equal(afterConflict.reconstructionInputDigest,persisted.reconstructionInputDigest);
 assert.deepEqual(afterConflict.reconstructionInput,persisted.reconstructionInput);
 assert.equal(await db.collection("movie_mentor_provider_operation_reality").countDocuments({providerCallId:raceId}),1);
 console.log("GREEN PHYSICAL RECONSTRUCTION CAS: eight competing inputs converge to one durable winner; conflicting replay explicitly denied; identical replay idempotent");
 console.log("GREEN PHYSICAL RECONSTRUCTION REPLAY INTEGRITY: forged digest and forged payload independently denied; original replay remains idempotent");
 await db.collection("movie_mentor_result_candidate").createIndex({candidateReference:1},{unique:true});
 for(const key of [{resultReference:1},{candidateReference:1},{executionId:1},{principalId:1,projectId:1,creatorTurnId:1},{reservationId:1}])await db.collection("movie_mentor_canonical_result").createIndex(key,{unique:true});
 await db.collection("movie_mentor_creator_state").createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 const principalId="isolated-execution-"+Date.now(),projectId="isolated-execution-project",creatorTurnId="isolated-turn-"+Date.now(),requestDigest=buildRequestDigest({creatorMessage:"isolated-http-positive",projectId:"isolated-execution-project",options:{}}),ownerId="isolated-worker";
 await db.collection(ENTITLEMENTS).insertOne({domain:DOMAIN,schema:SCHEMA,principalId,status:"active",remainingUnits:3,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 const spend=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(spend.ready,true,spend.reason);
 const reservation=await spend.authority.reserveTurn({serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},projectId});
 assert.equal(reservation.status,"reserved");
 const execution=createMovieMentorProductionInferenceExecutionComposition();
 assert.equal(execution.ready,true,execution.reason);
 assert.equal(isMovieMentorProductionInferenceExecutionOwnerProof(execution,execution.getStatus()),true);
 const input={creatorTurnId,principalId,projectId,reservationId:reservation.reservationId,requestDigest,ownerId,maxProviderCalls:1};
 const proof=next=>({authorized:true,currentOwnershipVerified:true,transition:"execution-creation",principalId:next.principalId,projectId:next.projectId,creatorTurnId:next.creatorTurnId,executionId:next.executionId,reservationId:next.reservationId,requestDigest:next.requestDigest,ownerId:next.ownerId,leaseGeneration:next.leaseGeneration,leaseReference:next.leaseReference,fencingToken:next.fencingToken});
 const opened=await execution.authority.openExecution({...input,assertCurrentCreationAuthority:async next=>proof(next)});
 assert.equal(opened.created,true);
 const record=await db.collection("movie_mentor_inference_execution").findOne({principalId,projectId,creatorTurnId});
 assert.ok(record,"physical execution required");
 assert.equal(record.reservationId,reservation.reservationId);
 assert.equal(record.requestDigest,requestDigest);
 assert.equal(record.phase,"active");
 const replay=await execution.authority.openExecution({...input,assertCurrentCreationAuthority:async()=>{throw Error("replay must not create");}});
 assert.equal(replay.idempotent,true);
 assert.equal(replay.executionId,opened.executionId);
 assert.equal(await db.collection("movie_mentor_inference_execution").countDocuments({principalId,projectId,creatorTurnId}),1);
 assert.equal(await db.collection(RESERVATIONS).countDocuments({principalId}),1);
 const entitlement=await db.collection(ENTITLEMENTS).findOne({principalId});
 assert.equal(entitlement.remainingUnits,2);
 assert.equal(entitlement.reservedUnits,1);
 assert.equal(entitlement.consumedUnits,0);
 const settlement=createMovieMentorProductionInferenceSettlementComposition();
 assert.equal(settlement.ready,true,settlement.reason);
 assert.equal(isMovieMentorProductionInferenceSettlementOwnerProof(settlement,settlement.getStatus()),true);
 const payload={success:true,message:"isolated-positive-candidate-boundary",metadata:{}};
 await assert.rejects(
  ()=>execution.authority.stageResultCandidate({execution:opened,resultPayload:payload,creatorStateConsumptionProof:null}),
  error=>error?.code==="MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_PROOF_REQUIRED"
 );
 assert.equal(await db.collection("movie_mentor_result_candidate").countDocuments({executionId:opened.executionId}),0);
 const balanceBefore=await db.collection(ENTITLEMENTS).findOne({principalId});
 assert.equal(balanceBefore.consumedUnits,0);
 console.log("GREEN PHYSICAL CANDIDATE DENIAL: production candidate staging rejects missing creator-state consumption proof without minting a candidate or debiting entitlement");
 console.log("LIMITATION: missing-proof negative control only; valid creator-state proof and positive candidate mint remain unproven.");
 const state={projectId,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"physical-candidate-fingerprint",resultCandidateBarrierRevision:0};
 await db.collection("movie_mentor_creator_state").insertOne(state);
 const {createMovieMentorCreatorStateConsumptionAuthority,assertMovieMentorCreatorStateConsumptionAuthority}=await import("../ai/MovieMentorCreatorStateConsumptionAuthority.js");
 let rechecks=0;
 const authorization={authorized:true,principalId,projectId,ownershipRef:"isolated-owner-ref",ownershipRevision:1};
 const capability=createMovieMentorCreatorStateConsumptionAuthority({authorization,requestAuthority:{authorize:async()=>{rechecks++;return authorization;}}});
 const currentProof=await assertMovieMentorCreatorStateConsumptionAuthority({authority:capability,projectId,stage:"result-candidate",revision:state.revision,creatorStateGeneration:state.creatorStateGeneration,creatorStateFingerprint:state.creatorStateFingerprint,executionId:opened.executionId});
 assert.equal(rechecks,1);
 const staged=await execution.authority.stageResultCandidate({execution:opened,resultPayload:payload,creatorStateConsumptionProof:currentProof});
 assert.equal(staged.executionId,opened.executionId);
 assert.ok(staged.candidateReference);
 const candidate=await db.collection("movie_mentor_result_candidate").findOne({executionId:opened.executionId});
 assert.ok(candidate);
 assert.equal(candidate.candidateReference,staged.candidateReference);
 assert.equal(await db.collection("movie_mentor_result_candidate").countDocuments({executionId:opened.executionId}),1);
 const stateAfter=await db.collection("movie_mentor_creator_state").findOne({projectId});
 assert.equal(stateAfter.resultCandidateBarrierRevision,1);
 const executionAfter=await db.collection("movie_mentor_inference_execution").findOne({executionId:opened.executionId});
 assert.equal(executionAfter.resultCandidateBarrierRevision,1);
 console.log("GREEN PHYSICAL POSITIVE CANDIDATE: production authority staged one immutable result candidate with atomic creator-state and execution write barriers");
 console.log("LIMITATION: fresh ownership recheck uses isolated injected authority; not live Clerk, real HTTP, provider dispatch, canonical finalization, debit or terminal replay.");
 const closing=await execution.authority.beginExecutionClosing({execution:opened});
 assert.equal(closing.authorized,true);
 assert.equal(closing.phase,"closing");
 const closed=await execution.authority.reconcileExecutionClosure({executionId:opened.executionId});
 assert.equal(closed.authorized,true);
 assert.equal(closed.phase,"closed");
 assert.equal(closed.currentRealityVerified,true);
 const persistedClosure=await db.collection("movie_mentor_inference_execution").findOne({executionId:opened.executionId});
 assert.equal(persistedClosure.phase,"closed");
 assert.ok(persistedClosure.closureCertificateDigest);
 const confirmed=await execution.authority.assertCurrentExecutionClosure({executionId:opened.executionId,closureReference:closed.closureReference,closureCertificateDigest:closed.closureCertificateDigest});
 assert.equal(confirmed.currentRealityVerified,true);
 const finalized=await execution.authority.commitCanonicalResult({closure:closed,result:payload});
 assert.equal(finalized.authorized,true);
 assert.equal(finalized.committed,true);
 assert.equal(finalized.resultFinalizationVerified,true);
 assert.equal(finalized.candidateLineageVerified,true);
 assert.equal(finalized.executionPhase,"finalized");
 const canonical=await db.collection("movie_mentor_canonical_result").findOne({executionId:opened.executionId});
 assert.ok(canonical);
 assert.equal(canonical.candidateReference,staged.candidateReference);
 const durableFinal=await db.collection("movie_mentor_inference_execution").findOne({executionId:opened.executionId});
 assert.equal(durableFinal.phase,"finalized");
 const replayFinal=await execution.authority.commitCanonicalResult({closure:closed,result:payload});
 assert.equal(replayFinal.idempotent,true);
 assert.equal(await db.collection("movie_mentor_canonical_result").countDocuments({executionId:opened.executionId}),1);
 console.log("GREEN PHYSICAL CANONICAL FINALIZATION: immutable candidate and current closure certificate converged atomically to one finalized canonical result; repeated commit idempotent");
 console.log("LIMITATION: zero-provider-call fixture, injected ownership recheck; settlement debit, terminal replay and real HTTP/provider execution not certified.");
 const simultaneous=await Promise.allSettled(Array.from({length:4},()=>settlement.authority.reconcile({executionId:opened.executionId})));
 const successful=simultaneous.filter(item=>item.status==="fulfilled").map(item=>item.value);
 assert.ok(successful.length>0,"At least one simultaneous settlement must succeed");
 assert.ok(successful.every(item=>item.settled===true&&item.authorized===true),"Every successful contender must prove settlement");
 const concurrentEntitlement=await db.collection(ENTITLEMENTS).findOne({principalId});
 assert.equal(concurrentEntitlement.remainingUnits,2);
 assert.equal(concurrentEntitlement.reservedUnits,0);
 assert.equal(concurrentEntitlement.consumedUnits,1);
 assert.equal(await db.collection(RESERVATIONS).countDocuments({reservationId:reservation.reservationId,status:"consumed"}),1);
 const rejected=simultaneous.filter(item=>item.status==="rejected");
 console.log("GREEN PHYSICAL CONCURRENT DEBIT FENCE: four overlapping settlement attempts produced one consumed reservation and exactly one entitlement debit; rejected contenders="+rejected.length);
 if(rejected.length)console.log("LIMITATION: "+rejected.length+" concurrent attempts rejected under contention; subsequent sequential retry must converge");
 const denied=await settlement.authority.reconcile({executionId:opened.executionId});
 assert.equal(denied.settled,true);
 assert.equal(denied.authorized,true);
 assert.equal(denied.idempotent,true);
 const settlementReplay=await settlement.authority.reconcile({executionId:opened.executionId});
 assert.equal(settlementReplay.settled,true);
 assert.equal(settlementReplay.authorized,true);
 assert.equal(settlementReplay.idempotent,true);
 assert.equal(settlementReplay.resultReference,finalized.resultReference);
 const terminal=await execution.authority.readCanonicalResult({executionId:opened.executionId});
 assert.equal(terminal.authorized,true);
 assert.equal(terminal.committed,true);
 assert.equal(terminal.executionPhase,"settled");
 assert.equal(terminal.resultReference,finalized.resultReference);
 assert.deepEqual(terminal.resultPayload,payload);
 const terminalReplay=await execution.authority.readCanonicalResult({executionId:opened.executionId});
 assert.equal(terminalReplay.authorized,true);
 assert.equal(terminalReplay.resultReference,terminal.resultReference);
 assert.deepEqual(terminalReplay.resultPayload,terminal.resultPayload);
 assert.equal(await db.collection("movie_mentor_canonical_result").countDocuments({executionId:opened.executionId}),1);
 console.log("GREEN PHYSICAL TERMINAL REPLAY: settled canonical result re-read with intact candidate lineage and unchanged result payload");
 const balance=await db.collection(ENTITLEMENTS).findOne({principalId});
 assert.equal(balance.remainingUnits,2);
 assert.equal(balance.reservedUnits,0);
 assert.equal(balance.consumedUnits,1);
 const row=await db.collection(RESERVATIONS).findOne({reservationId:reservation.reservationId});
 assert.equal(row.status,"consumed");
 console.log("GREEN PHYSICAL SETTLEMENT REPLAY: finalized result consumed one reserved unit; repeated settlement idempotent without second debit");
 console.log("LIMITATION: zero-provider-call fixture and injected ownership; provider dispatch and full runtime remain uncertified.");
 // Physical provider admission and revoked ownership are tested through the actual fresh HTTP runtime.
 await db.collection("movie_mentor_creator_state").updateOne({projectId},{$set:{
  revisionAuthorityReference:"isolated-revision-ref",creatorAuthorityReference:"isolated-creator-ref",
  snapshotReference:"isolated-snapshot-ref",capturedAt:new Date(),creatorConfirmedContext:[]
 }});
 const ownershipCollection=db.collection("movie_mentor_isolated_http_ownership");
 await ownershipCollection.insertOne({projectId,principalId,status:"active",revision:1});
 let revoked=false,denyAtDispatch=false,denyDurableAtDispatch=false,providerInvocations=0,semanticCalls=0,orchestrations=0;
 const requestAuthority={authorize:async ({request,projectId:requested})=>{
  const currentOwnership=await ownershipCollection.findOne({projectId:requested,principalId});
  if(revoked||currentOwnership?.status!=="active"||request.headers.authorization!=="Bearer isolated-http"||requested!==projectId){
   const e=new Error("Current creator ownership revoked");e.code="MOVIE_MENTOR_AUTH_REVOKED";throw e;
  }
  return {authorized:true,principalId,projectId,ownershipRef:"isolated-http-owner",ownershipRevision:1};
 }};
 const executionAuthority={
  ...execution.authority,
  beginProviderDispatch:async input=>{
   if(denyAtDispatch)revoked=true;
   if(denyDurableAtDispatch){
    const changed=await ownershipCollection.updateOne({projectId,principalId,status:"active"},{$set:{status:"revoked"},$inc:{revision:1}});
    assert.equal(changed.modifiedCount,1,"physical ownership revocation must commit before provider dispatch");
   }
   return execution.authority.beginProviderDispatch(input);
  }
 };
 const router=createMovieMentorTurnRouter({
  requestAuthority,inferenceSpendAuthority:spend.authority,
  inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlement.authority,
  runTurn:(input,deps)=>runMovieMentorTurnWithForwardExecutionAuthority(input,{...deps,
   interpretSemantics:async()=>{semanticCalls++;providerInvocations++;return {responseId:"isolated-provider-effect-"+semanticCalls,provider:"openai",meaning:"isolated"};},
   orchestrateTurn:async(_input,orchestrationDeps)=>{
    orchestrations++;
    const semantic=await orchestrationDeps.interpretSemantics({message:"isolated-provider-boundary"}).catch(error=>{console.error("PROVIDER_COURT_DIAGNOSTIC",JSON.stringify({code:error?.code||null,message:error?.message||null,reason:error?.reason||null,details:error?.details||null}));throw error;});
    return {success:true,message:"isolated-provider-result",semantic,metadata:{}};
   }
  }),
  applyStateTransition:async()=>{throw Error("unexpected state transition");}
 });
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 const server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
 try{
  const endpoint="http://127.0.0.1:"+server.address().port+"/api/movie-mentor/turn";
  const invoke=async creatorTurnId=>{
   const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer isolated-http"},body:JSON.stringify({projectId,creatorTurnId,input:{message:"isolated-provider-http"},options:{}})});
   return {status:response.status,body:await response.json()};
  };
  const firstTurn=creatorTurnId+"-provider-positive";
  const positive=await invoke(firstTurn);
  assert.equal(positive.status,200,JSON.stringify(positive.body));
  assert.equal(positive.body.metadata.canonicalResult.replayedFromDurableResult,false);
  assert.equal(providerInvocations,1);
  const executionRow=await db.collection("movie_mentor_inference_execution").findOne({principalId,projectId,creatorTurnId:firstTurn});
  assert.equal(executionRow.phase,"settled");
  const replay=await invoke(firstTurn);
  assert.equal(replay.status,200,JSON.stringify(replay.body));
  assert.equal(replay.body.metadata.canonicalResult.replayedFromDurableResult,true);
  assert.equal(providerInvocations,1);
  console.log("GREEN PHYSICAL HTTP PROVIDER POSITIVE: durable provider admission, UNKNOWN-before-network, fenced isolated provider invocation, evidence and settlement, replay without second provider invocation");
  denyDurableAtDispatch=true;
  const durableTurn=creatorTurnId+"-provider-durable-revoked";
  const durableDenied=await invoke(durableTurn);
  assert.notEqual(durableDenied.status,200,JSON.stringify(durableDenied.body));
  assert.equal(providerInvocations,1,"durably revoked ownership must prevent irreversible provider function invocation");
  assert.equal((await ownershipCollection.findOne({projectId,principalId})).status,"revoked");
  assert.equal(await db.collection("movie_mentor_canonical_result").countDocuments({principalId,projectId,creatorTurnId:durableTurn}),0);
  console.log("GREEN PHYSICAL HTTP DURABLE OWNERSHIP REVOCATION: Mongo ownership changed after HTTP admission and before dispatch, fresh ownership read denied provider invocation");
  const restored=await ownershipCollection.updateOne({projectId,principalId,status:"revoked"},{$set:{status:"active"},$inc:{revision:1}});
  assert.equal(restored.modifiedCount,1,"isolated fixture must restore ownership before independent in-memory revocation court");
  denyDurableAtDispatch=false;
  const secondTurn=creatorTurnId+"-provider-revoked";
  denyAtDispatch=true;
  const denied=await invoke(secondTurn);
  assert.notEqual(denied.status,200,JSON.stringify(denied.body));
  assert.equal(providerInvocations,1,"revoked ownership must prevent irreversible provider function invocation");
  assert.equal(await db.collection("movie_mentor_canonical_result").countDocuments({principalId,projectId,creatorTurnId:secondTurn}),0);
  console.log("GREEN PHYSICAL HTTP PROVIDER REVOCATION: ownership revoked at UNKNOWN boundary and provider function never invoked");
  console.log("LIMITATION: isolated provider function and injected request authority; real provider transport and live Clerk not certified.");
 }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}finally{await mongoose.disconnect();}
