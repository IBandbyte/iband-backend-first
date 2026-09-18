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
await assert.rejects(()=>fenced.interpretSemantics({proof:true}),e=>e?.code==="MOVIE_MENTOR_PROVIDER_OPERATION_IDENTITY_CONFLICT", "mismatched dispatch authority must fail closed before provider");
assert.equal(assertCalls,1,"runtime must obtain current dispatch authority before choosing the irreversible operation identity");
assert.equal(providerCalls,0,"mismatched durable operation identity must stop before provider");
console.log("Movie Mentor provider dispatch return binding authority: EXONERATED");
console.log("LAW: BEGIN-DISPATCH EVIDENCE CANNOT BYPASS THE CURRENT DISPATCH IDENTITY FENCE BEFORE PROVIDER.");
