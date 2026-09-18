import assert from "node:assert/strict";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const execution=Object.freeze({authorized:true,executionId:"execution-current-dispatch-bind"});
const call=Object.freeze({authorized:true,dispatchAuthorized:true,providerCallId:"call-current-dispatch-bind",executionId:execution.executionId,slotId:"semantic",task:"movie-mentor-semantic"});
let providerCalls=0;
const authority={
 async claimProviderCall(){return call;},
 async bindProviderReconstructionInput(){return {authorized:true,inputBound:true};},
 async beginProviderDispatch(){return {authorized:true,dispatchAuthorized:true,effectState:"unknown"};},
 async assertProviderDispatch(){return {authorized:true,dispatchAuthorized:true,providerOperationIdentity:{providerOperationId:"call-OTHER",executionId:"execution-OTHER",slotId:"story",task:"movie-mentor-specialist:story"}};},
 async contributeProviderEffectEvidence(){return {accepted:true,state:"confirmed"};}
};
const fenced=createFencedInferenceOrchestrationDeps({execution,inferenceExecutionAuthority:authority,deps:{interpretSemantics:async()=>{providerCalls+=1;return {ok:true};}}});
await assert.rejects(()=>fenced.interpretSemantics({proof:true}),e=>e?.code==="MOVIE_MENTOR_PROVIDER_OPERATION_IDENTITY_CONFLICT","mismatched current dispatch identity must fail closed");
assert.equal(providerCalls,0,"mismatched current dispatch identity must stop before provider");
console.log("Movie Mentor current provider dispatch return binding authority: PASS");
console.log("LAW: CURRENT DISPATCH AUTHORIZATION FOR A DIFFERENT PROVIDER-CALL UNIVERSE IS NOT FORWARD AUTHORITY.");
