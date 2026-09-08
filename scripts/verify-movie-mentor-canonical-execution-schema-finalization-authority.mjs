import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";
import { getMovieMentorInferenceExecutionMongoStoreStatus } from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;};
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const executionStatus=getMovieMentorInferenceExecutionMongoStoreStatus();
assert.equal(executionStatus.schema,6,"court must track the current inference execution schema");
const payload={success:true,mentorResponse:{text:"Only current execution schema may acquire FINALIZED authority."}},resultDigest=digest(payload);

async function attempt(schema){
  const record={resultReference:`result-exec-schema-${schema}`,candidateReference:`candidate-exec-schema-${schema}`,executionId:`execution-exec-schema-${schema}`,creatorTurnId:`turn-exec-schema-${schema}`,principalId:`creator-exec-schema-${schema}`,projectId:`project-exec-schema-${schema}`,reservationId:`reservation-exec-schema-${schema}`,requestDigest:`request-exec-schema-${schema}`,closureReference:`closure-exec-schema-${schema}`,closureCertificateDigest:`closure-digest-exec-schema-${schema}`,resultDigest,resultPayload:stable(payload),committedAt:"2032-01-01T00:00:00.000Z"};
  let canonicalRow=null;
  const model={findOne(query){return{session(){return this;},lean(){return this;},async exec(){if(!canonicalRow)return null;if(query.executionId&&canonicalRow.executionId!==query.executionId)return null;if(query.principalId&&canonicalRow.principalId!==query.principalId)return null;if(query.projectId&&canonicalRow.projectId!==query.projectId)return null;if(query.creatorTurnId&&canonicalRow.creatorTurnId!==query.creatorTurnId)return null;return structuredClone(canonicalRow);}};},async create(rows){canonicalRow=structuredClone(rows[0]);return[structuredClone(canonicalRow)];}};
  let executionRow={domain:"iband.movie-mentor.inference-execution-store",schema,phase:"closed",providerEffectRealityRevision:7,executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,leaseGeneration:8,leaseReference:`lease-exec-schema-${schema}`,fencingToken:`fence-exec-schema-${schema}`,closureReference:record.closureReference,closureCertificateDigest:record.closureCertificateDigest,resultFinalizationBarrierRevision:0};
  const candidateRow={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:record.candidateReference,executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,resultDigest,resultPayload:stable(payload),stagedFromLeaseGeneration:8,stagedFromLeaseReference:`lease-exec-schema-${schema}`,stagedFromFencingToken:`fence-exec-schema-${schema}`,creatorStateRevision:12,creatorStateGeneration:5,creatorStateFingerprint:`state-exec-schema-${schema}`,creatorStateOwnershipRef:`ownership-exec-schema-${schema}`,creatorStateOwnershipRevision:3,stagedAt:"2031-12-31T23:59:59.000Z"};
  const executionCollection={async findOne(){return structuredClone(executionRow);},async updateOne(filter,update){executionRow={...executionRow,...structuredClone(update.$set),resultFinalizationBarrierRevision:executionRow.resultFinalizationBarrierRevision+1};return{matchedCount:1};}};
  const candidateCollection={async findOne(){return structuredClone(candidateRow);}};
  const session={async withTransaction(fn){return fn();},async endSession(){}};
  const store=createMovieMentorCanonicalResultMongoStore({mongoModel:model,executionCollection,candidateCollection,startSession:async()=>session});
  try{const result=await store.commit(record,{expectedProviderEffectRealityRevision:7});return{ok:true,result,executionRow};}
  catch(error){return{ok:false,error,executionRow};}
}

const current=await attempt(6);
assert.equal(current.ok,true,"current execution schema 6 must cross CLOSED -> FINALIZED");
assert.equal(current.executionRow.phase,"finalized");

const legacy=await attempt(5);
assert.equal(legacy.ok,false,"legacy execution schema 5 must fail closed before acquiring FINALIZED authority");
assert.equal(legacy.error?.code,"MOVIE_MENTOR_CANONICAL_RESULT_EXECUTION_NOT_CLOSED");
assert.equal(legacy.executionRow.phase,"closed","legacy execution must not be promoted to FINALIZED");

console.log("GREEN: canonical finalization grants irreversible FINALIZED authority only to the current durable execution schema.");
console.log("LAW: HISTORY MAY SURVIVE. AUTHORITY MAY NOT. CURRENT DURABLE EXECUTION SCHEMA MUST CROSS CLOSED -> FINALIZED OR THE GATE FAILS CLOSED.");
