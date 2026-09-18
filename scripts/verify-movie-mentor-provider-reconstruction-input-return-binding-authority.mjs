import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const execution = Object.freeze({ authorized:true, executionId:"execution-input-bind", creatorTurnId:"turn-input-bind", principalId:"principal-input-bind", projectId:"project-input-bind", reservationId:"reservation-input-bind", requestDigest:"digest-input-bind", ownerId:"owner-input-bind", leaseGeneration:7, leaseReference:"lease-input-bind", fencingToken:"fence-input-bind" });
const call = Object.freeze({ ...execution, dispatchAuthorized:true, providerCallId:"call-input-bind", slotId:"semantic", task:"movie-mentor-semantic" });
let beginCalls=0, assertCalls=0, providerCalls=0;
const fenced=createFencedInferenceOrchestrationDeps({execution,inferenceExecutionAuthority:{
 async claimProviderCall(){return call;},
 async bindProviderReconstructionInput(){return {authorized:true,inputBound:true,providerCallId:"call-OTHER",reconstructionInputDigest:"digest-OTHER"};},
 async beginProviderDispatch(){beginCalls+=1;return {dispatchAuthorized:true};},
 async assertProviderDispatch(){assertCalls+=1;return {dispatchAuthorized:true};},
 async contributeProviderEffectEvidence(){return {accepted:true};}
},deps:{interpretSemantics:async()=>{providerCalls+=1;throw new Error("MISMATCHED_INPUT_BINDING_MUST_NOT_DISPATCH");}}});
await assert.rejects(()=>fenced.interpretSemantics({proof:true}),e=>e?.code==="MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_BINDING_INVALID");
assert.equal(beginCalls,0);assert.equal(assertCalls,0);assert.equal(providerCalls,0);
console.log("LAW: RECONSTRUCTION-INPUT AUTHORIZATION WITHOUT EXACT PROVIDER-CALL BINDING IS NOT FORWARD AUTHORITY.");
console.log("Movie Mentor provider reconstruction-input return binding authority: GREEN");
