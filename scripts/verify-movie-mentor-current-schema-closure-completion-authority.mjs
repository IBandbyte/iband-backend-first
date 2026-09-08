import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const frozenDigest=digest([]);

async function attempt(schema){
  let completeCalls=0;
  let durable={
    schema,
    phase:"closing",
    executionId:`execution-closure-complete-${schema}`,
    creatorTurnId:`turn-closure-complete-${schema}`,
    principalId:"creator-closure-complete",
    projectId:"project-closure-complete",
    reservationId:`reservation-closure-complete-${schema}`,
    requestDigest:"request-closure-complete",
    ownerId:"owner-closure-complete",
    leaseGeneration:3,
    leaseReference:"lease-closure-complete",
    fencingToken:"fence-closure-complete",
    providerCalls:[],
    providerCallsClaimed:0,
    providerEffectRealityRevision:0,
    frozenProviderCallCount:0,
    frozenProviderCallSetDigest:frozenDigest,
    closureReference:`closure-complete-${schema}`,
    closurePolicyVersion:"5A.24-round-four-v6",
    closureCertificateDigest:"",
  };
  const store={
    readExecution:async()=>structuredClone(durable),
    beginClosing:async()=>structuredClone(durable),
    recoverExpiredIntoClosing:async()=>structuredClone(durable),
    async completeClosing(input){
      completeCalls+=1;
      durable={...durable,phase:"closed",closureCertificateDigest:input.closureCertificateDigest,closedAt:input.closedAt};
      return structuredClone(durable);
    },
    quarantineExecution:async()=>structuredClone(durable),
  };
  const authority=createMovieMentorInferenceExecutionClosureAuthority({store,effectStore:{readEffect:async()=>null},now:()=>new Date("2032-01-01T00:00:00.000Z")});
  const result=await authority.reconcile({executionId:durable.executionId});
  return {result,durable,completeCalls};
}

const current=await attempt(6);
assert.equal(current.result?.authorized,true,"current schema-6 CLOSING execution must remain eligible to complete closure");
assert.equal(current.result?.closed,true,"current schema-6 execution must cross CLOSING -> CLOSED after current provider reality is certified");
assert.equal(current.durable.phase,"closed");
assert.equal(current.completeCalls,1);

const legacy=await attempt(5);
assert.equal(legacy.result?.authorized,false,"legacy readable execution schema must not acquire CLOSED authority through closure completion");
assert.equal(legacy.result?.reason,"execution-current-schema-required");
assert.equal(legacy.durable.phase,"closing","legacy execution history must remain CLOSING rather than being promoted to CLOSED authority");
assert.equal(legacy.completeCalls,0,"legacy execution must fail before the durable CLOSING -> CLOSED write primitive");

console.log("✓ legacy readable execution schemas cannot cross CLOSING -> CLOSED authority");
console.log("LAW: HISTORY MAY SURVIVE. AUTHORITY MAY NOT. ONLY CURRENT EXECUTION SCHEMA 6 MAY COMPLETE CLOSURE.");
console.log("current-schema closure completion authority gate: GREEN");
