import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const serverNow=Date.parse("2032-01-01T00:02:00.000Z");
const laggingNow=new Date(serverNow-120000);
const durable={
 schema:6,executionId:"execution-lagging-authority",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"digest-1",
 phase:"active",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",
 leaseAcquiredAt:new Date(serverNow-60000).toISOString(),leaseExpiresAt:new Date(serverNow-1000).toISOString(),
 maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,resultCandidateBarrierRevision:0
};
assert.ok(Date.parse(durable.leaseExpiresAt)<=serverNow);
assert.ok(Date.parse(durable.leaseExpiresAt)>laggingNow.getTime());

let recoveryCalls=0;
const store={
 readExecution:async()=>structuredClone(durable),
 beginClosing:async()=>structuredClone(durable),
 recoverExpiredIntoClosing:async input=>{
  recoveryCalls++;
  assert.equal(input.requireDurablyExpired,true);
  return {...structuredClone(durable),phase:"closing",closureReference:input.closureReference,frozenProviderCallCount:input.frozenProviderCallCount,frozenProviderCallSetDigest:input.frozenProviderCallSetDigest,closingAt:input.closingAt,closedFromExecutionGeneration:1,closurePolicyVersion:input.closurePolicyVersion};
 },
 completeClosing:async()=>null,
 quarantineExecution:async()=>null
};
const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{readEffect:async()=>null},now:()=>new Date(laggingNow),randomId:()=>"court"});
const result=await authority.recoverExpiredIntoClosing({executionId:durable.executionId});
assert.equal(recoveryCalls,1,"lagging process clock must delegate expiry decision to durable store");
assert.equal(result.recoveredExpired,true,"Mongo-authoritatively expired execution must remain recoverable through production closure authority");
console.log("LAW: DURABLE STORE OWNS EXPIRED-EXECUTION RECOVERY ELIGIBILITY; A LAGGING PROCESS CLOCK MAY NOT VETO DELEGATION.");
console.log("execution closure authority lagging-clock delegation: GREEN");
