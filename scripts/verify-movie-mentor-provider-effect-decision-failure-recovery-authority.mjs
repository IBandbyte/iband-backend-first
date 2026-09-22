import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

console.log("5A.next — provider-effect / Creator-decision failure recovery authority");

const durable={projectId:"project-305",creatorSessionId:"session-305",revision:30,revisionAuthorityReference:"revision:project-305:30",creatorStateGeneration:15,creatorStateFingerprint:"a".repeat(64),creatorAuthorityReference:"creator-state:project-305:g15",snapshotReference:"snapshot:project-305:r30:g15",capturedAt:"2026-09-22T12:00:00.000Z",creatorConfirmedContext:[],projectJourney:{stageId:"build",taskId:"continue"},memoryContext:{projectId:"project-305"},responseBlueprint:{depth:"guided"},communicationPlan:{tone:"warm"}};
const serverAuthority={authenticated:true,projectAuthorized:true,principalId:"creator-305",projectId:"project-305"};
const reservation={authorized:true,reservationId:"reservation-305",principalId:"creator-305",projectId:"project-305",operation:"movie-mentor-turn",units:1,status:"reserved"};
const exec={authorized:true,executionId:"execution-305",creatorTurnId:"turn-305",principalId:"creator-305",projectId:"project-305",reservationId:"reservation-305",requestDigest:"test-digest",phase:"active",ownerId:"owner-305",leaseGeneration:1,leaseReference:"lease-305",fencingToken:"fence-305",leaseExpiresAt:"2099-01-01T00:00:00.000Z"};
const providerCall={authorized:true,dispatchAuthorized:true,executionId:exec.executionId,providerCallId:"provider-call-305",slotId:"semantic",task:"movie-mentor-semantic",ownerId:exec.ownerId,leaseGeneration:1,leaseReference:exec.leaseReference,fencingToken:exec.fencingToken};

let existing=false,providerMintCount=0,claimAttempts=0,providerDispatches=0,providerEffects=0,recoveryAttempts=0,releaseAttempts=0,reserveCalls=0,acquireCalls=0;
const executionAuthority={
 async findExecutionByCreatorTurn(){return existing?{...exec,found:true}:{found:false,authorized:false};},
 async openExecution(){existing=true;return exec;},
 async acquireExecution(){acquireCalls+=1;return exec;},
 async assertFence(){return exec;},
 async claimProviderCall(){
   claimAttempts+=1;
   if(providerMintCount===0){providerMintCount+=1;return providerCall;}
   return{authorized:false,dispatchAuthorized:false,reason:"provider-call-slot-already-admitted",existingProviderCall:{providerCallId:providerCall.providerCallId,executionId:exec.executionId,slotId:"semantic",task:"movie-mentor-semantic"}};
 },
 async bindProviderReconstructionInput(){return{authorized:true,inputBound:true};},
 async beginProviderDispatch(){providerDispatches+=1;return{authorized:true,dispatchAuthorized:true,effectState:"unknown"};},
 async assertProviderDispatch(){return{authorized:true,dispatchAuthorized:true};},
 async contributeProviderEffectEvidence(){providerEffects+=1;return{accepted:true,state:"confirmed"};},
 async recoverProviderOutcome(){recoveryAttempts+=1;throw Object.assign(new Error("historical provider recovery deliberately stopped after admission proof"),{code:"TEST_RECOVERY_REACHED"});},
 async readProviderOperation(){throw new Error("recovery stop must occur before reconstruction read");},
 async stageResultCandidate(){throw new Error("candidate must not stage after decision failure");},
 async readResultCandidate(){return null;},
 async beginExecutionClosing(){return{};},async reconcileExecutionClosure(){return{};},async commitCanonicalResult(){return{};},async readCanonicalResult(){return{authorized:false,committed:false};}
};
const spendAuthority={async reserveTurn(){reserveCalls+=1;return reservation;},async readReservation(){return{...reservation,rehydrated:true};}};
const settlementAuthority={
 async reconcile(){return{authorized:false,settled:false,outcome:"reserved"};},
 async releaseUnclaimed(){releaseAttempts+=1;return{authorized:false,released:false,outcome:"reserved",reason:"provider-call-claims-exist",providerCallsClaimed:1};},
 async releaseUnbound(){return{authorized:false,released:false,outcome:"reserved",reason:"reservation-already-bound-to-execution",executionId:exec.executionId};},
 async compensateSupersededCreatorState(){return{authorized:false,compensated:false,outcome:"reserved"};}
};

let orchestrationAttempts=0;
async function orchestrate(input,deps){
 orchestrationAttempts+=1;
 await deps.interpretSemantics({message:input.message,context:{}});
 if(orchestrationAttempts===1){const e=new Error("Creator decision commit failed after provider effect");e.code="TEST_CREATOR_DECISION_COMMIT_FAILED";throw e;}
 throw new Error("retry unexpectedly escaped historical provider recovery");
}
const input={projectId:"project-305",creatorSessionId:"session-305",creatorTurnId:"turn-305",message:"continue"};
const deps={
 serverAuthority,inferenceSpendAuthority:spendAuthority,inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlementAuthority,
 createExecutionOwnerId:()=>"owner-305",readAuthoritativeTurnSource:async()=>structuredClone(durable),orchestrateTurn:orchestrate,
 interpretSemantics:async()=>({responseId:"provider-response-305",provider:"synthetic",structured:{readyToAdvance:true}})
};

await assert.rejects(()=>runMovieMentorTurn(input,deps),e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED"&&e?.providerCallsClaimed===1);
assert.equal(releaseAttempts,1,"post-effect failure must ask atomic zero-claim release and be refused");
assert.equal(providerMintCount,1,"first attempt must durably mint exactly one provider operation");
assert.equal(providerDispatches,1,"first attempt must cross exactly one provider dispatch");
assert.equal(providerEffects,1,"first attempt must durably record provider effect evidence");
assert.equal(reserveCalls,1);

await assert.rejects(()=>runMovieMentorTurn(input,deps),e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED"&&e?.providerCallsClaimed===1);
assert.equal(reserveCalls,1,"same-turn retry must reuse the existing reservation");
assert.equal(acquireCalls,1,"same-turn retry must reacquire the existing execution");
assert.equal(claimAttempts,2,"retry must revisit the durable provider slot");
assert.equal(providerMintCount,1,"retry must not mint a second provider operation");
assert.equal(recoveryAttempts,1,"retry must enter historical provider recovery");
assert.equal(providerDispatches,1,"retry must not redispatch provider work");
assert.equal(providerEffects,1,"retry must not admit a second provider effect");
assert.equal(releaseAttempts,2,"unresolved historical recovery must remain fail-closed and reserved");

console.log("✓ post-effect Creator-decision failure cannot release reserved value");
console.log("✓ same-turn retry reacquires the existing execution and historical provider slot");
console.log("✓ retry enters recovery without a second provider mint, dispatch, or effect");
console.log("LAW: durable provider reality survives a later Creator-decision failure; retry must recover that exact universe, never mint another.");
