import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const clone=value=>value==null?value:structuredClone(value);
const base={
 domain:"iband.movie-mentor.inference-execution-store",schema:6,
 executionId:"execution-reality-clock-race",creatorTurnId:"turn-reality-clock-race",
 principalId:"creator-reality-clock-race",projectId:"project-reality-clock-race",
 reservationId:"reservation-reality-clock-race",requestDigest:"digest-reality-clock-race",
 phase:"active",ownerId:"worker-A",leaseGeneration:4,leaseReference:"lease-4",
 fencingToken:"fence-4",leaseAcquiredAt:new Date("2036-01-01T00:00:00.000Z"),
 leaseExpiresAt:new Date("2036-01-01T00:10:00.000Z"),maxProviderCalls:2,
 providerCallsClaimed:1,providerCalls:[{providerCallId:"call-1",slotId:"semantic",
 task:"movie-mentor-semantic",state:"admitted",leaseGeneration:4,
 leaseReference:"lease-4",fencingToken:"fence-4",admittedAt:new Date("2036-01-01T00:01:00.000Z")}],
 abandonedPredispatchProviderCalls:[],providerEffectRealityRevision:0,
 settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,
 resultCandidateBarrierRevision:0,closureReference:"",frozenProviderCallCount:null,
 frozenProviderCallSetDigest:"",closingAt:null,closedFromExecutionGeneration:null,
 closurePolicyVersion:"",closureCertificateDigest:"",closedAt:null,
 finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",
 resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",
 settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",
 compensatedAt:null,compensationReason:"",quarantinedAt:null,quarantineReason:"",
 quarantinedFromPhase:""
};
let durable=clone(base),readCount=0;
function query(executor){return{lean(){return this;},async exec(){return executor();}};}
const model={
 findOne(filter){
  return query(()=>{
   if(filter.executionId!==durable.executionId)return null;
   const snapshot=clone(durable);
   readCount+=1;
   if(readCount===1){
    // Exact adversarial interleaving: the lease writer has read revision N.
    // Provider-effect transaction then advances the execution reality clock to N+1.
    durable.providerEffectRealityRevision+=1;
   }
   return snapshot;
  });
 },
 findOneAndUpdate(filter,update){
  return query(()=>{
   const matches=
    durable.executionId===filter.executionId&&durable.phase===filter.phase&&
    durable.leaseGeneration===filter.leaseGeneration&&durable.leaseReference===filter.leaseReference&&
    durable.providerCallsClaimed===filter.providerCallsClaimed&&
    durable.resultCandidateBarrierRevision===filter.resultCandidateBarrierRevision&&
    (!filter.leaseExpiresAt||new Date(durable.leaseExpiresAt).getTime()===new Date(filter.leaseExpiresAt).getTime())&&
    (filter.providerEffectRealityRevision===undefined||durable.providerEffectRealityRevision===filter.providerEffectRealityRevision);
   if(!matches)return null;
   durable={...durable,...clone(update.$set)};
   return clone(durable);
  });
 }
};
const store=createMovieMentorInferenceExecutionMongoStore({mongoModel:model});
const stale=clone(base);
stale.leaseExpiresAt=new Date("2036-01-01T00:20:00.000Z").toISOString();
const written=await store.replaceExecution(stale,{
 expectedPhase:"active",expectedLeaseGeneration:4,expectedLeaseReference:"lease-4",
 expectedLeaseExpiresAt:"2036-01-01T00:10:00.000Z"
});
assert.equal(readCount,1,"court must execute one stale execution read before the competing reality advance");
if(written&&written.providerEffectRealityRevision===0&&durable.providerEffectRealityRevision===0){
 throw new Error("RED: active lease replacement accepted a stale whole-record snapshot after provider-effect reality advanced N→N+1 and regressed providerEffectRealityRevision back to N.");
}
assert.equal(written,null,"lease replacement must lose the race when provider-effect reality advances after its read");
assert.equal(durable.providerEffectRealityRevision,1,"provider-effect reality clock must remain monotonic after a stale lease replacement attempt");
console.log("GREEN: stale active lease replacement cannot regress the provider-effect reality clock.");
console.log("LAW: LEASE MAINTENANCE MAY CHANGE LEASE AUTHORITY; IT MAY NOT REWRITE A NEWER PROVIDER-REALITY GENERATION.");
