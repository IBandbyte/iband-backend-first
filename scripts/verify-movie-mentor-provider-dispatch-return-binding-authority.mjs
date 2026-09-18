import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const execution=Object.freeze({authorized:true,executionId:"execution-dispatch-bind"});
const call=Object.freeze({authorized:true,dispatchAuthorized:true,providerCallId:"call-dispatch-bind",executionId:execution.executionId,slotId:"semantic",task:"movie-mentor-semantic"});
let assertCalls=0,providerCalls=0;
const authority={
 async claimProviderCall(){return call;},
 async bindProviderReconstructionInput(){return {authorized:true,inputBound:true};},
 async beginProviderDispatch(){return {authorized:true,dispatchAuthorized:true,providerOperationIdentity:{providerOperationId:"call-OTHER",executionId:"execution-OTHER",slotId:"story",task:"movie-mentor-specialist:story"}};},
 async assertProviderDispatch(){assertCalls+=1;return {authorized:true,dispatchAuthorized:true};},
 async contributeProviderEffectEvidence(){return {accepted:true,state:"confirmed"};}
};
const fenced=createFencedInferenceOrchestrationDeps({execution,inferenceExecutionAuthority:authority,deps:{interpretSemantics:async()=>{providerCalls+=1;return {ok:true};}}});
await assert.rejects(()=>fenced.interpretSemantics({proof:true}),e=>e?.code==="MOVIE_MENTOR_PROVIDER_DISPATCH_BINDING_INVALID", "MISMATCHED_DISPATCH_MUST_NOT_REACH_PROVIDER");
assert.equal(assertCalls,0,"mismatched UNKNOWN authority must stop before current-dispatch assertion");
assert.equal(providerCalls,0,"mismatched UNKNOWN authority must stop before provider");
console.log("Movie Mentor provider dispatch return binding authority: PASS");
console.log("LAW: UNKNOWN AUTHORIZATION WITHOUT EXACT PROVIDER-CALL BINDING IS NOT FORWARD AUTHORITY.");
