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

const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now,leaseMs:60000,maxProviderCalls:5,randomId:()=>`gate-${++id}`});
const genuine=await authority.openExecution({creatorTurnId:"turn-gate",principalId:"creator-gate",projectId:"project-gate",reservationId:"reservation-gate",requestDigest:"digest-gate",ownerId:"worker-gate",maxProviderCalls:5});
assert.equal(genuine.authorized,true);

const forged=Object.freeze({...genuine});
assert.deepEqual(forged,genuine);
assert.notEqual(forged,genuine);
let escaped=false;
try{
  const result=await authority.claimProviderCall({execution:forged,slotId:"forged-slot",task:"movie-mentor-semantic"});
  escaped=result?.dispatchAuthorized===true;
}catch(error){
  assert.equal(error?.code,"MOVIE_MENTOR_INFERENCE_EXECUTION_OWNER_PROOF_REQUIRED");
}
assert.equal(escaped,false,"structurally equal reconstructed execution evidence must receive zero provider-call authority");

const secondAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store,now,leaseMs:60000,maxProviderCalls:5,randomId:()=>`other-${++id}`});
let crossAuthorityEscaped=false;
try{
  const result=await secondAuthority.claimProviderCall({execution:genuine,slotId:"cross-authority-slot",task:"movie-mentor-semantic"});
  crossAuthorityEscaped=result?.dispatchAuthorized===true;
}catch(error){
  assert.equal(error?.code,"MOVIE_MENTOR_INFERENCE_EXECUTION_OWNER_PROOF_REQUIRED");
}
assert.equal(crossAuthorityEscaped,false,"execution proof issued by one authority instance must not authorize another authority instance");

console.log("✓ reconstructed execution evidence receives zero provider-call authority");
console.log("✓ execution evidence cannot cross issuer authority instances");
console.log("LAW: DURABLE EXECUTION STATE → EXECUTION AUTHORITY ISSUES OWNER PROOF → PROVIDER-CALL CLAIM CONSUMES THAT EXACT OWNER PROOF → DISPATCH");
console.log("Zorg: My copy says authorized:true. Kraken: WHO ISSUED IT?");
console.log("Gates of Execution owner-proof torture: GREEN");
