import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const clone=(v)=>v==null?v:structuredClone(v);
let durable=null,id=0;
const now=()=>new Date("2031-01-01T00:00:00.000Z");
const store={
  async readExecution(executionId){return durable?.executionId===executionId?clone(durable):null;},
  async readExecutionByCreatorTurn({principalId,projectId,creatorTurnId}={}){return durable&&durable.principalId===principalId&&durable.projectId===projectId&&durable.creatorTurnId===creatorTurnId?clone(durable):null;},
  async createExecution(next){if(durable)return null;durable=clone(next);return clone(durable);},
  async replaceExecution(next){durable=clone(next);return clone(durable);},
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

const forged=Object.freeze({...genuine});
assert.deepEqual(forged,genuine);
assert.notEqual(forged,genuine);
const forgedDecision=await authority.assertProviderDispatch({providerCall:forged});
assert.equal(forgedDecision?.dispatchAuthorized,false,"structurally equal reconstructed provider-call evidence must receive zero fresh dispatch authority");

const secondAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store,now,leaseMs:60000,maxProviderCalls:5,randomId:()=>`other-dispatch-${++id}`});
const crossAuthorityDecision=await secondAuthority.assertProviderDispatch({providerCall:genuine});
assert.equal(crossAuthorityDecision?.dispatchAuthorized,false,"provider-call proof issued by one execution authority instance must not authorize dispatch through another authority instance");

console.log("✓ reconstructed provider-call evidence receives zero fresh dispatch authority");
console.log("✓ provider-call evidence cannot cross issuer authority instances");
console.log("LAW: DURABLE PROVIDER-CALL ADMISSION → EXECUTION AUTHORITY ISSUES OWNER PROOF → DISPATCH FENCE CONSUMES THAT EXACT OWNER PROOF → PROVIDER DISPATCH");
console.log("Zorg: But the photocopy is laminated. Kraken: WHO ISSUED IT?");
console.log("Gates of Execution provider-dispatch owner-proof torture: GREEN");
