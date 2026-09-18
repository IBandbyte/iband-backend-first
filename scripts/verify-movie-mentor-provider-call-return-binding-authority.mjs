import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
const execution=Object.freeze({authorized:true,executionId:"execution-call-bind",creatorTurnId:"turn-call-bind",principalId:"principal-call-bind",projectId:"project-call-bind",reservationId:"reservation-call-bind",requestDigest:"digest-call-bind",ownerId:"owner-call-bind",leaseGeneration:7,leaseReference:"lease-call-bind",fencingToken:"fence-call-bind"});
let bindCalls=0,beginCalls=0,assertCalls=0,providerCalls=0;
const authority={
 async claimProviderCall({slotId,task}){assert.equal(slotId,"semantic");assert.equal(task,"movie-mentor-semantic");return{authorized:true,dispatchAuthorized:true,executionId:"execution-OTHER",creatorTurnId:"turn-OTHER",principalId:"principal-OTHER",projectId:"project-OTHER",reservationId:"reservation-OTHER",requestDigest:"digest-OTHER",providerCallId:"call-OTHER",slotId:"character",task:"movie-mentor-character",ownerId:"owner-OTHER",leaseGeneration:99,leaseReference:"lease-OTHER",fencingToken:"fence-OTHER"};},
 async bindProviderReconstructionInput(){bindCalls++;return{authorized:true,inputBound:true};},
 async beginProviderDispatch(){beginCalls++;return{authorized:true,dispatchAuthorized:true,effectState:"unknown"};},
 async assertProviderDispatch(){assertCalls++;return{authorized:true,dispatchAuthorized:true};},
 async contributeProviderEffectEvidence(){throw new Error("NO_EFFECT");}
};
const fenced=createFencedInferenceOrchestrationDeps({execution,inferenceExecutionAuthority:authority,deps:{interpretSemantics:async()=>{providerCalls++;throw new Error("MISMATCHED_PROVIDER_CALL_MUST_NOT_DISPATCH");}}});
await assert.rejects(()=>fenced.interpretSemantics({proof:true}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_BINDING_INVALID");
assert.equal(bindCalls,0);assert.equal(beginCalls,0);assert.equal(assertCalls,0);assert.equal(providerCalls,0);
console.log("PASS: dispatchAuthorized provider-call evidence must bind exact execution/turn/principal/project/reservation/request/owner/lease/fence/slot/task before any durable dispatch preparation.");
console.log("LAW: PROVIDER-CALL AUTHORIZATION WITHOUT EXACT DURABLE CALL BINDING IS NOT FORWARD AUTHORITY.");
