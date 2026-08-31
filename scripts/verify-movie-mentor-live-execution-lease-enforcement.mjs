import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
import { createMovieMentorProductionInferenceExecutionComposition } from "../ai/MovieMentorProductionInferenceExecutionComposition.js";

const clone=(v)=>v==null?v:structuredClone(v);
let clock=new Date("2031-01-01T00:00:00.000Z"), durable=null, id=0;
const store={
  getStatus:()=>({configured:true,readiness:"injected-proven",durable:true,cas:"reservation-binding-active-closure-frozen-universe-provider-reality-revision-finalized-result-binding-and-atomic-abort"}),
  async readExecution(executionId){return durable?.executionId===executionId?clone(durable):null;},
  async readExecutionByCreatorTurn({principalId,projectId,creatorTurnId}={}){return durable&&durable.principalId===principalId&&durable.projectId===projectId&&durable.creatorTurnId===creatorTurnId?clone(durable):null;},
  async createExecution(next){if(durable)return null;durable=clone(next);return clone(durable);},
  async replaceExecution(next,expected={}){
    if(!durable||durable.phase!==expected.expectedPhase||durable.leaseGeneration!==expected.expectedLeaseGeneration||durable.leaseReference!==expected.expectedLeaseReference)return null;
    if(expected.expectedLeaseExpiresAt&&durable.leaseExpiresAt!==expected.expectedLeaseExpiresAt)return null;
    durable=clone(next);return clone(durable);
  },
  async claimProviderCall(input={}){
    if(!durable||durable.executionId!==input.executionId)return{claimed:false,execution:null,existingProviderCall:null};
    const existing=durable.providerCalls.find((call)=>call.slotId===input.slotId)||null;
    const live=durable.phase==="active"&&durable.ownerId===input.ownerId&&durable.leaseGeneration===input.leaseGeneration&&durable.leaseReference===input.leaseReference&&durable.fencingToken===input.fencingToken&&new Date(durable.leaseExpiresAt).getTime()>new Date(input.admittedAt).getTime();
    if(existing||!live||durable.providerCallsClaimed>=durable.maxProviderCalls)return{claimed:false,execution:clone(durable),existingProviderCall:clone(existing)};
    const providerCall={providerCallId:input.providerCallId,slotId:input.slotId,task:input.task,state:"admitted",leaseGeneration:input.leaseGeneration,leaseReference:input.leaseReference,fencingToken:input.fencingToken,admittedAt:input.admittedAt};
    durable.providerCalls.push(providerCall);durable.providerCallsClaimed+=1;
    return{claimed:true,execution:clone(durable),providerCall:clone(providerCall)};
  },
  async beginClosing(){return null;},
  async recoverExpiredIntoClosing(){return null;},
  async completeClosing(){return null;},
  async quarantineExecution(){return null;},
};

const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(clock),leaseMs:1000,maxProviderCalls:2,randomId:()=>`id-${++id}`});
const binding={creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"digest-1",ownerId:"worker-A",maxProviderCalls:2};

console.log("5A.24 Round Two — live execution lease enforcement torture");

const g1=await authority.openExecution(binding);
assert.equal(g1.authorized,true);assert.equal(g1.leaseGeneration,1);
const semantic=await authority.claimProviderCall({execution:g1,slotId:"semantic",task:"movie-mentor-semantic"});
assert.equal(semantic.dispatchAuthorized,true);
const duplicate=await authority.claimProviderCall({execution:g1,slotId:"semantic",task:"movie-mentor-semantic"});
assert.equal(duplicate.dispatchAuthorized,false);assert.equal(duplicate.reason,"provider-call-slot-already-admitted");

clock=new Date(clock.getTime()+1001);
const g2=await authority.acquireExecution({executionId:g1.executionId,ownerId:"worker-B"});
assert.equal(g2.authorized,true);assert.equal(g2.leaseGeneration,2);
const zombie=await authority.claimProviderCall({execution:g1,slotId:"story",task:"movie-mentor-specialist:story"});
assert.equal(zombie.dispatchAuthorized,false);assert.equal(zombie.reason,"execution-lease-fenced");
const story=await authority.claimProviderCall({execution:g2,slotId:"story",task:"movie-mentor-specialist:story"});
assert.equal(story.dispatchAuthorized,true);
const exhausted=await authority.claimProviderCall({execution:g2,slotId:"synthesis",task:"movie-mentor-synthesis"});
assert.equal(exhausted.dispatchAuthorized,false);assert.equal(exhausted.reason,"provider-call-budget-exhausted");

const composed=createMovieMentorProductionInferenceExecutionComposition({store});
assert.equal(composed.ready,true);assert.equal(typeof composed.authority.claimProviderCall,"function");

const unprovenExecutionStore={...store,getStatus:undefined};
const rejectedExecution=createMovieMentorProductionInferenceExecutionComposition({store:unprovenExecutionStore});
assert.equal(rejectedExecution.ready,false);
assert.equal(rejectedExecution.reason,"inference-execution-injected-capability-not-proven");
const selfDescribedButUnprovenExecutionStore={...store,getStatus:()=>({configured:true,readiness:"injected"})};
const rejectedExecutionClaim=createMovieMentorProductionInferenceExecutionComposition({store:selfDescribedButUnprovenExecutionStore});
assert.equal(rejectedExecutionClaim.ready,false);
assert.equal(rejectedExecutionClaim.reason,"inference-execution-injected-capability-not-proven");

const unprovenEffectStore={readEffect:async()=>null,beginUnknown:async()=>null,appendEvidence:async()=>null};
const rejectedEffect=createMovieMentorProductionInferenceExecutionComposition({store,effectStore:unprovenEffectStore});
assert.equal(rejectedEffect.ready,false);
assert.equal(rejectedEffect.reason,"provider-effect-injected-capability-not-proven");
const provenEffectStore={
  getStatus:()=>({configured:true,readiness:"injected-proven",cas:"revision",crossLedgerSerialization:"execution-providerEffectRealityRevision"}),
  readEffect:async()=>null,
  beginUnknown:async()=>null,
  appendEvidence:async()=>null,
};
const methodShapedResultStore={readByExecution:async()=>null,readByCreatorTurn:async()=>null,commit:async()=>null};
const rejectedResult=createMovieMentorProductionInferenceExecutionComposition({store,effectStore:provenEffectStore,resultStore:methodShapedResultStore});
assert.equal(rejectedResult.ready,false);
assert.equal(rejectedResult.reason,"canonical-result-injected-capability-not-proven");
const methodShapedCandidateStore={stageCandidate:async()=>null,readByExecution:async()=>null};
const rejectedCandidate=createMovieMentorProductionInferenceExecutionComposition({store,effectStore:provenEffectStore,candidateStore:methodShapedCandidateStore});
assert.equal(rejectedCandidate.ready,false);
assert.equal(rejectedCandidate.reason,"result-candidate-injected-capability-not-proven");

const slots=[], executed=[],dispatches=[],evidence=[];
const fakeExecution={authorized:true,executionId:"execution-live",ownerId:"owner-live",leaseGeneration:7,leaseReference:"lease-7",fencingToken:"fence-7"};
const fakeAuthority={
  async claimProviderCall({slotId,task}){slots.push(slotId);return{authorized:true,dispatchAuthorized:true,providerCallId:`call-${slotId}`,slotId,task,executionId:"execution-live",ownerId:"owner-live",leaseGeneration:7,leaseReference:"lease-7",fencingToken:"fence-7"};},
  async beginProviderDispatch({providerCall}){dispatches.push(`begin:${providerCall.slotId}`);return{authorized:true,dispatchAuthorized:true,providerCallId:providerCall.providerCallId};},
  async assertProviderDispatch({providerCall}){dispatches.push(`assert:${providerCall.slotId}`);return{authorized:true,dispatchAuthorized:true,providerCallId:providerCall.providerCallId};},
  async contributeProviderEffectEvidence(input){evidence.push(input);return{authorized:true,recorded:true};},
};
const fenced=createFencedInferenceOrchestrationDeps({
  execution:fakeExecution,
  inferenceExecutionAuthority:fakeAuthority,
  deps:{
    interpretSemantics:async()=>{executed.push("semantic");return{ok:true};},
    executeSpecialistWorkOrder:async(workOrder)=>{executed.push(workOrder.agentId);return{contribution:{agentId:workOrder.agentId},metadata:{}};},
    synthesizeResponse:async()=>{executed.push("synthesis");return{success:true,text:"ok"};},
  },
});
await fenced.interpretSemantics({});
const planResult=await fenced.executeSpecialistPlan({workOrders:[{agentId:"story"},{agentId:"character"},{agentId:"continuity"}]});
assert.equal(planResult.status,"completed");
await fenced.synthesizeResponse({});
assert.deepEqual(slots,["semantic","story","character","continuity","synthesis"]);
assert.deepEqual(executed,["semantic","story","character","continuity","synthesis"]);
assert.deepEqual(dispatches,["begin:semantic","assert:semantic","begin:story","assert:story","begin:character","assert:character","begin:continuity","assert:continuity","begin:synthesis","assert:synthesis"]);
assert.equal(evidence.length,0);

let escaped=false;
const denied=createFencedInferenceOrchestrationDeps({
  execution:fakeExecution,
  inferenceExecutionAuthority:{
    async claimProviderCall(){return{authorized:false,dispatchAuthorized:false,reason:"execution-lease-fenced"};},
    async beginProviderDispatch(){throw new Error("must not reach dispatch-begin after denied claim");},
    async assertProviderDispatch(){throw new Error("must not reach dispatch-fence after denied claim");},
    async contributeProviderEffectEvidence(){throw new Error("must not record evidence after denied claim");},
  },
  deps:{interpretSemantics:async()=>{escaped=true;return{};}},
});
await assert.rejects(()=>denied.interpretSemantics({}),error=>error.code==="MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_NOT_AUTHORIZED");
assert.equal(escaped,false);

console.log("✓ provider-call claim is durable and slot-bounded");
console.log("✓ duplicate logical slot cannot mint second dispatch authority");
console.log("✓ generation takeover fences zombie provider execution");
console.log("✓ provider-call budget is enforced at admission");
console.log("✓ injected execution/provider-effect/canonical-result/result-candidate stores receive zero capability credit from method shape or composition");
console.log("✓ each injected dependency must own getStatus() and expose the exact durable capability contract consumed by production composition");
console.log("✓ Semantic, Story, Character, Continuity and Synthesis cross claim → durable UNKNOWN → current dispatch fence before provider invocation");
console.log("✓ denied claim prevents UNKNOWN creation, dispatch fencing and provider invocation");
console.log("LAW: NO COMPONENT GETS CREDIT FOR ITS NEIGHBOUR'S PROOF. METHOD PRESENCE IS NOT DURABLE AUTHORITY. NO SUCCESSFUL DURABLE CALL CLAIM + NO DURABLE UNKNOWN + NO CURRENT DISPATCH FENCE → NO PROVIDER DISPATCH");
console.log("5A.24 Round Two torture: GREEN");
