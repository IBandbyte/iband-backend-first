import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const now=new Date("2032-01-01T00:00:00.000Z");
const base={schema:5,executionId:"execution-legacy",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",phase:"active",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseAcquiredAt:"2031-12-31T23:59:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:5,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0};
let durable=structuredClone(base),beginCalls=0,recoveryCalls=0;
const store={
  readExecution:async()=>structuredClone(durable),
  beginClosing:async input=>{beginCalls++;Object.assign(durable,{phase:"closing",closureReference:input.closureReference,frozenProviderCallCount:input.frozenProviderCallCount,frozenProviderCallSetDigest:input.frozenProviderCallSetDigest,closingAt:input.closingAt,closedFromExecutionGeneration:durable.leaseGeneration,closurePolicyVersion:input.closurePolicyVersion});return structuredClone(durable);},
  recoverExpiredIntoClosing:async input=>{recoveryCalls++;Object.assign(durable,{phase:"closing",closureReference:input.closureReference,frozenProviderCallCount:input.frozenProviderCallCount,frozenProviderCallSetDigest:input.frozenProviderCallSetDigest,closingAt:input.closingAt,closedFromExecutionGeneration:durable.leaseGeneration,closurePolicyVersion:input.closurePolicyVersion});return structuredClone(durable);},
  completeClosing:async()=>null,
  quarantineExecution:async()=>null,
};
const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{readEffect:async()=>null},now:()=>new Date(now),randomId:()=>"court"});
const liveProof={authorized:true,executionId:base.executionId,ownerId:base.ownerId,leaseGeneration:base.leaseGeneration,leaseReference:base.leaseReference,fencingToken:base.fencingToken};
const direct=await authority.beginClosing({execution:liveProof});
assert.equal(direct.authorized,false,"legacy execution schema must not acquire CLOSING authority through live closure entry");
assert.equal(direct.reason,"execution-current-schema-required");
assert.equal(beginCalls,0,"legacy schema must fail before the irreversible beginClosing store transition");

durable={...structuredClone(base),leaseExpiresAt:"2031-12-31T23:59:59.000Z"};
const recovered=await authority.recoverExpiredIntoClosing({executionId:base.executionId});
assert.equal(recovered.authorized,false,"legacy execution schema must not acquire CLOSING authority through expired recovery entry");
assert.equal(recovered.reason,"execution-current-schema-required");
assert.equal(recoveryCalls,0,"legacy schema must fail before the irreversible recovery-to-CLOSING store transition");

console.log("✓ legacy readable execution schemas cannot acquire CLOSING authority through live or expired-recovery entry");
console.log("LAW: HISTORICAL EXECUTION SCHEMAS MAY REMAIN READABLE. ONLY CURRENT SCHEMA 6 MAY CROSS INTO CLOSING AUTHORITY.");
console.log("current-schema closure entry authority gate: GREEN");
