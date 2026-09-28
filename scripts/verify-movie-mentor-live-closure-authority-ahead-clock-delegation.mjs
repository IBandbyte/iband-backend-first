import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const serverNow=new Date("2032-01-01T00:02:00.000Z");
const aheadNow=new Date(serverNow.getTime()+120000);
const leaseExpiresAt=new Date(serverNow.getTime()+60000);
assert.ok(leaseExpiresAt.getTime()>serverNow.getTime());
assert.ok(leaseExpiresAt.getTime()<=aheadNow.getTime());

let beginCalls=0;
const durable={schema:6,executionId:"execution-live-ahead",creatorTurnId:"turn-live-ahead",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"digest-1",phase:"active",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseAcquiredAt:new Date(serverNow.getTime()-60000).toISOString(),leaseExpiresAt:leaseExpiresAt.toISOString(),maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,resultCandidateBarrierRevision:0};
const store={
 async readExecution(){return structuredClone(durable);},
 async beginClosing(input){beginCalls+=1;assert.equal(input.executionId,durable.executionId);return {...structuredClone(durable),phase:"closing",closureReference:input.closureReference,frozenProviderCallCount:input.frozenProviderCallCount,frozenProviderCallSetDigest:input.frozenProviderCallSetDigest,closingAt:input.closingAt,closedFromExecutionGeneration:1,closurePolicyVersion:input.closurePolicyVersion};},
 async recoverExpiredIntoClosing(){return structuredClone(durable);},
 async completeClosing(){return structuredClone(durable);},
 async quarantineExecution(){return structuredClone(durable);}
};
const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{async readEffect(){return null;}},now:()=>new Date(aheadNow),randomId:()=>"ahead-clock"});
const result=await authority.beginClosing({execution:{authorized:true,executionId:durable.executionId,ownerId:durable.ownerId,leaseGeneration:1,leaseReference:durable.leaseReference,fencingToken:durable.fencingToken}});
assert.equal(beginCalls,1,"ahead process clock must delegate live-lease validity to durable store");
assert.equal(result.phase,"closing","durably live execution must remain eligible for closure despite ahead process clock");
console.log("LAW: DURABLE STORE OWNS LIVE-LEASE VALIDITY AT CLOSURE ENTRY; AN AHEAD PROCESS CLOCK MAY NOT VETO DELEGATION.");
console.log("live closure authority ahead-clock delegation: GREEN");
