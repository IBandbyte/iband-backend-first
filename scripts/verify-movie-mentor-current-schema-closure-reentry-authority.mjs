import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const frozenProviderCallSetDigest=digest([]);

async function assertForSchema(schema){
  const executionId=`execution-closure-reentry-${schema}`;
  const closureReference=`closure-reentry-${schema}`;
  const record={
    schema,
    phase:"closed",
    executionId,
    creatorTurnId:`turn-closure-reentry-${schema}`,
    principalId:"creator-closure-reentry",
    projectId:"project-closure-reentry",
    reservationId:`reservation-closure-reentry-${schema}`,
    requestDigest:"request-closure-reentry",
    ownerId:"owner-closure-reentry",
    leaseGeneration:4,
    leaseReference:"lease-closure-reentry",
    fencingToken:"fence-closure-reentry",
    providerCalls:[],
    providerCallsClaimed:0,
    providerEffectRealityRevision:0,
    frozenProviderCallCount:0,
    frozenProviderCallSetDigest,
    closureReference,
    closurePolicyVersion:"5A.24-round-four-v6",
    closedAt:"2032-01-01T00:00:00.000Z",
  };
  const certificate={
    executionId:record.executionId,
    creatorTurnId:record.creatorTurnId,
    principalId:record.principalId,
    projectId:record.projectId,
    reservationId:record.reservationId,
    requestDigest:record.requestDigest,
    closureReference:record.closureReference,
    frozenProviderCallSetDigest:record.frozenProviderCallSetDigest,
    closurePolicyVersion:record.closurePolicyVersion,
    realities:[],
  };
  record.closureCertificateDigest=digest(certificate);
  let quarantineCalls=0;
  const store={
    readExecution:async()=>structuredClone(record),
    beginClosing:async()=>structuredClone(record),
    recoverExpiredIntoClosing:async()=>structuredClone(record),
    completeClosing:async()=>structuredClone(record),
    quarantineExecution:async()=>{quarantineCalls+=1;return structuredClone(record);},
  };
  const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{readEffect:async()=>null},now:()=>new Date("2032-01-01T00:00:01.000Z")});
  const result=await authority.assertCurrentClosure({executionId,closureReference,closureCertificateDigest:record.closureCertificateDigest});
  return {result,quarantineCalls};
}

const current=await assertForSchema(6);
assert.equal(current.result?.authorized,true,"current schema-6 CLOSED execution must retain current closure authority when reality and certificate are exact");
assert.equal(current.result?.closed,true);
assert.equal(current.result?.currentRealityVerified,true);
assert.equal(current.quarantineCalls,0);

const legacy=await assertForSchema(5);
assert.equal(legacy.result?.authorized,false,"legacy readable CLOSED execution must not reacquire current closure authority");
assert.equal(legacy.result?.reason,"execution-current-schema-required");
assert.equal(legacy.quarantineCalls,0,"historical schema is not a reality conflict and must remain history rather than being quarantined merely for age");

console.log("✓ current schema-6 closure proof remains reusable while exact reality remains current");
console.log("✓ legacy readable CLOSED history cannot be promoted back into current closure authority");
console.log("LAW: HISTORY MAY SURVIVE. CURRENT CLOSURE AUTHORITY MAY NOT BE RE-MINTED FROM A LEGACY EXECUTION SCHEMA.");
console.log("current-schema closure re-entry authority gate: GREEN");
