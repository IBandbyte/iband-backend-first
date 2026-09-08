import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { getMovieMentorCanonicalResultMongoStoreStatus } from "../ai/MovieMentorCanonicalResultMongoStore.js";

console.log("5A.28 — canonical-result schema settlement authority torture");
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.keys(value).sort().reduce((out,key)=>(out[key]=stable(value[key]),out),{}):value;
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const resultStatus=getMovieMentorCanonicalResultMongoStoreStatus();
assert.equal(resultStatus.schema,2,"verifier must target the schema actually emitted by the current canonical-result store");
async function settlementReasonFor(resultSchema){
  const payload={success:true,mentorResponse:{text:"Current canonical reality only."}},resultDigest=digest(payload);
  const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"finalized",executionId:`execution-result-schema-${resultSchema}`,creatorTurnId:`turn-result-schema-${resultSchema}`,principalId:"creator-schema",projectId:"project-schema",reservationId:`reservation-result-schema-${resultSchema}`,requestDigest:"request-schema",leaseGeneration:7,leaseReference:"lease-canonical-schema",fencingToken:"fence-canonical-schema",closureReference:"closure-schema",closureCertificateDigest:"closure-digest-schema",finalizedResultReference:"deliberately-wrong-result-reference",finalizedCandidateReference:`candidate-result-schema-${resultSchema}`,finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:00:00.000Z")};
  const result={domain:"iband.movie-mentor.canonical-result-store",schema:resultSchema,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:execution.closureCertificateDigest,resultReference:`result-schema-${resultSchema}`,resultDigest,resultPayload:payload,...(resultSchema===resultStatus.schema?{candidateReference:`candidate-result-schema-${resultSchema}`}:{})};
  const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:`candidate-result-schema-${resultSchema}`,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload,stagedFromLeaseGeneration:execution.leaseGeneration,stagedFromLeaseReference:execution.leaseReference,stagedFromFencingToken:execution.fencingToken,creatorStateRevision:11,creatorStateGeneration:12,creatorStateFingerprint:"creator-state-fingerprint-canonical-schema",creatorStateOwnershipRef:"creator-state-ownership-canonical-schema",creatorStateOwnershipRevision:13,stagedAt:new Date("2031-12-31T23:59:59.000Z")};
  const rows=new Map([["movie_mentor_inference_execution",execution],["movie_mentor_canonical_result",result],["movie_mentor_result_candidate",candidate]]),database={collection(name){return{async findOne(){return structuredClone(rows.get(name)||null);}};}},session={async withTransaction(fn){return fn();},async endSession(){}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>database,now:()=>new Date("2032-01-01T00:00:01.000Z")});
  return (await store.settleCanonicalResult({executionId:execution.executionId})).reason;
}
const currentReason=await settlementReasonFor(resultStatus.schema);assert.equal(currentReason,"canonical-result-finalization-binding-invalid",`current schema-${resultStatus.schema} canonical result must cross schema validation and proof-bearing candidate authority to reach the deliberately later finalization fence; got ${currentReason}`);
const legacyReason=await settlementReasonFor(1);assert.equal(legacyReason,"canonical-result-binding-invalid",`legacy canonical schema must fail closed at settlement before candidate/finalization authority; got ${legacyReason}`);
console.log(`✓ current canonical schema-${resultStatus.schema} crosses settlement validation with proof-bearing candidate lineage`);console.log("✓ legacy canonical schema is denied authority at the irreversible settlement boundary");console.log("LAW: CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED");console.log("5A.28 canonical-result schema settlement authority torture: GREEN");

// Backend CI owns the adjacent irreversible-schema authority courts directly
// rather than borrowing their dedicated workflow results.
await import("./verify-movie-mentor-canonical-execution-schema-finalization-authority.mjs");
await import("./verify-movie-mentor-legacy-canonical-finalization-authority.mjs");
await import("./verify-movie-mentor-legacy-canonical-read-authority.mjs");
await import("./verify-movie-mentor-current-schema-closure-entry-authority.mjs");
await import("./verify-movie-mentor-current-schema-closure-completion-authority.mjs");
await import("./verify-movie-mentor-current-schema-closure-reentry-authority.mjs");
