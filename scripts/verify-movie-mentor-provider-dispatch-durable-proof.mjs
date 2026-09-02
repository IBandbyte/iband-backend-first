import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const clone=(v)=>v==null?v:structuredClone(v);
let durable=null,id=0,clock=Date.parse("2031-01-01T00:00:00.000Z");
const now=()=>new Date(clock);
const store={
  async readExecution(executionId){return durable?.executionId===executionId?clone(durable):null;},
  async readExecutionByCreatorTurn({principalId,projectId,creatorTurnId}={}){return durable&&durable.principalId===principalId&&durable.projectId===projectId&&durable.creatorTurnId===creatorTurnId?clone(durable):null;},
  async createExecution(next){if(durable)return null;durable=clone(next);return clone(durable);},
  async replaceExecution(next,{expectedPhase,expectedLeaseGeneration,expectedLeaseReference,expectedLeaseExpiresAt}={}){
    if(!durable)return null;
    if(expectedPhase!==undefined&&durable.phase!==expectedPhase)return null;
    if(expectedLeaseGeneration!==undefined&&durable.leaseGeneration!==expectedLeaseGeneration)return null;
    if(expectedLeaseReference!==undefined&&durable.leaseReference!==expectedLeaseReference)return null;
    if(expectedLeaseExpiresAt!==undefined&&durable.leaseExpiresAt!==expectedLeaseExpiresAt)return null;
    durable=clone(next);return clone(durable);
  },
  async claimProviderCall(input={}){
    if(!durable||durable.executionId!==input.executionId)return{claimed:false,execution:null};
    const existing=durable.providerCalls.find(call=>call.slotId===input.slotId)||null;
    const live=durable.phase==="active"&&durable.ownerId===input.ownerId&&durable.leaseGeneration===input.leaseGeneration&&durable.leaseReference===input.leaseReference&&durable.fencingToken===input.fencingToken&&new Date(durable.leaseExpiresAt)>new Date(input.admittedAt);
    if(existing||!live)return{claimed:false,execution:clone(durable),existingProviderCall:clone(existing)};
    const providerCall={providerCallId:input.providerCallId,slotId:input.slotId,task:input.task,leaseGeneration:input.leaseGeneration,leaseReference:input.leaseReference,fencingToken:input.fencingToken,admittedAt:input.admittedAt};
    durable.providerCalls.push(providerCall);durable.providerCallsClaimed+=1;
    return{claimed:true,execution:clone(durable),providerCall:clone(providerCall)};
  }
};

const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now,leaseMs:60000,maxProviderCalls:5,randomId:()=>`dispatch-gate-${++id}`});
const execution=await authority.openExecution({creatorTurnId:"turn-dispatch",principalId:"creator-dispatch",projectId:"project-dispatch",reservationId:"reservation-dispatch",requestDigest:"digest-dispatch",ownerId:"worker-dispatch",maxProviderCalls:5});
const genuine=await authority.claimProviderCall({execution,slotId:"semantic-slot",task:"movie-mentor-semantic"});
assert.equal(genuine.dispatchAuthorized,true,"genuine admitted provider call must be dispatch-authorized");

const reconstructed=Object.freeze({...genuine});
assert.deepEqual(reconstructed,genuine);
assert.notEqual(reconstructed,genuine);
const reconstructedDecision=await authority.assertProviderDispatch({providerCall:reconstructed});
assert.equal(reconstructedDecision?.dispatchAuthorized,true,"a reconstructed lookup may regain permission only when the durable admitted call is still current");

const restartedAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store,now,leaseMs:60000,maxProviderCalls:5,randomId:()=>`restart-dispatch-${++id}`});
const restartDecision=await restartedAuthority.assertProviderDispatch({providerCall:reconstructed});
assert.equal(restartDecision?.dispatchAuthorized,true,"a restarted authority may re-establish permission from the exact current durable admitted call");

const neverAdmitted=Object.freeze({...genuine,providerCallId:"provider-call-never-admitted"});
const neverAdmittedDecision=await restartedAuthority.assertProviderDispatch({providerCall:neverAdmitted});
assert.equal(neverAdmittedDecision?.dispatchAuthorized,false,"a convincing call that was never durably admitted must receive zero dispatch permission");

const wrongSlot=Object.freeze({...genuine,slotId:"different-slot"});
const wrongSlotDecision=await restartedAuthority.assertProviderDispatch({providerCall:wrongSlot});
assert.equal(wrongSlotDecision?.dispatchAuthorized,false,"a call with no exact durable call-and-slot match must receive zero dispatch permission");

clock+=61000;
const takeover=await restartedAuthority.acquireExecution({executionId:execution.executionId,ownerId:"worker-after-expiry"});
assert.equal(takeover?.authorized,true,"expired execution must be acquirable into a new durable generation");
assert.equal(takeover?.leaseGeneration,2,"takeover must advance the durable lease generation");
const staleDecision=await restartedAuthority.assertProviderDispatch({providerCall:genuine});
assert.equal(staleDecision?.dispatchAuthorized,false,"a formerly admitted call from an older generation must receive zero dispatch permission");

console.log("✓ exact current durable admission can re-establish dispatch permission after reconstruction or restart");
console.log("✓ a call absent from durable admission receives zero dispatch permission");
console.log("✓ wrong-slot and old-generation calls receive zero dispatch permission");
console.log("LAW: DURABLE PROVIDER-CALL ADMISSION + CURRENT EXECUTION UNIVERSE → FRESH DISPATCH PERMISSION → PROVIDER");
console.log("Zorg: But my photocopy has all the boxes ticked. Kraken: CHECK THE LEDGER, ZORG.");
console.log("Gates of Execution provider-dispatch durable-proof gate: GREEN");
