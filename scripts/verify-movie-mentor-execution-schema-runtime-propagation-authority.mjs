import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";

const now=new Date("2032-01-01T00:00:00.000Z");
let raw={
  domain:"iband.movie-mentor.inference-execution-store",
  schema:6,
  executionId:"execution-schema-runtime",
  creatorTurnId:"turn-schema-runtime",
  principalId:"creator-schema-runtime",
  projectId:"project-schema-runtime",
  reservationId:"reservation-schema-runtime",
  requestDigest:"request-schema-runtime",
  phase:"active",
  ownerId:"owner-schema-runtime",
  leaseGeneration:1,
  leaseReference:"lease-schema-runtime",
  fencingToken:"fence-schema-runtime",
  leaseAcquiredAt:"2031-12-31T23:59:00.000Z",
  leaseExpiresAt:"2032-01-01T00:10:00.000Z",
  maxProviderCalls:5,
  providerCallsClaimed:0,
  providerCalls:[],
  providerEffectRealityRevision:0,
  settlementRealityBarrierRevision:0,
  resultFinalizationBarrierRevision:0,
  closureReference:"",
  frozenProviderCallCount:null,
  frozenProviderCallSetDigest:"",
  closingAt:null,
  closedFromExecutionGeneration:null,
  closurePolicyVersion:"",
  closureCertificateDigest:"",
  closedAt:null,
  finalizedResultReference:"",
  finalizedCandidateReference:"",
  finalizedResultDigest:"",
  resultFinalizedAt:null,
  settledResultReference:"",
  settledCandidateReference:"",
  settledResultDigest:"",
  settledAt:null,
  abortedAt:null,
  abortReason:"",
  quarantinedAt:null,
  quarantineReason:"",
  quarantinedFromPhase:"",
};
let updates=0;
const query=row=>({lean(){return this;},exec:async()=>row?structuredClone(row):null});
const mongoModel={
  findOne(filter){if(filter.executionId&&filter.executionId!==raw.executionId)return query(null);return query(raw);},
  findOneAndUpdate(filter,update){
    updates+=1;
    if(filter.executionId!==raw.executionId||filter.phase!==raw.phase)return query(null);
    raw={...raw,...structuredClone(update.$set||{})};
    return query(raw);
  },
};
const durableStore=createMovieMentorInferenceExecutionMongoStore({mongoModel,reservationCollection:false});
const normalized=await durableStore.readExecution(raw.executionId);
assert.equal(normalized?.domain,raw.domain,"durable execution domain identity must survive the store read boundary");
assert.equal(normalized?.schema,6,"current durable execution schema must survive the store read boundary into runtime authority");

const closure=createMovieMentorInferenceExecutionClosureAuthority({store:durableStore,effectStore:{readEffect:async()=>null},now:()=>new Date(now),randomId:()=>"schema-runtime"});
const result=await closure.beginClosing({execution:{authorized:true,executionId:raw.executionId,ownerId:raw.ownerId,leaseGeneration:raw.leaseGeneration,leaseReference:raw.leaseReference,fencingToken:raw.fencingToken}});
assert.equal(result?.authorized,true,"real current schema-6 durable record must retain closure-entry authority after normalization");
assert.equal(result?.phase,"closing");
assert.equal(updates,1,"current schema-6 closure entry must reach the durable ACTIVE -> CLOSING primitive exactly once");

console.log("✓ durable execution domain/schema identity survives normalization into runtime authority");
console.log("✓ real schema-6 store read composes with closure authority and crosses ACTIVE -> CLOSING");
console.log("LAW: A CURRENT-SCHEMA GATE CANNOT WORK IF THE STORE ERASES THE SCHEMA BEFORE THE AUTHORITY BOUNDARY.");
console.log("execution schema runtime propagation authority gate: GREEN");
