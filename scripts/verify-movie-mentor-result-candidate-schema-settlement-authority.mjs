import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { getMovieMentorResultCandidateMongoStoreStatus } from "../ai/MovieMentorResultCandidateMongoStore.js";

console.log("5A.27 — result-candidate schema settlement authority torture");

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const candidateStatus = getMovieMentorResultCandidateMongoStoreStatus();
assert.equal(candidateStatus.schema, 2, "verifier must exercise the schema actually emitted by the current result-candidate store");
const payload = { success: true, mentorResponse: { text: "Schema two is current reality." } };
const resultDigest = digest(payload);
const execution = {domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"finalized",executionId:"execution-schema-2",creatorTurnId:"turn-schema-2",principalId:"creator-schema-2",projectId:"project-schema-2",reservationId:"reservation-schema-2",requestDigest:"request-schema-2",leaseGeneration:7,leaseReference:"lease-schema-2",fencingToken:"fence-schema-2",closureReference:"closure-schema-2",closureCertificateDigest:"closure-digest-schema-2",finalizedResultReference:"deliberately-wrong-result-reference",finalizedCandidateReference:"candidate-schema-2",finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:00:00.000Z")};
const result = {domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:execution.closureCertificateDigest,resultReference:"result-schema-2",candidateReference:"candidate-schema-2",resultDigest,resultPayload:payload};
const candidate = {domain:"iband.movie-mentor.result-candidate-store",schema:candidateStatus.schema,candidateReference:"candidate-schema-2",executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload,stagedFromLeaseGeneration:execution.leaseGeneration,stagedFromLeaseReference:execution.leaseReference,stagedFromFencingToken:execution.fencingToken,creatorStateRevision:11,creatorStateGeneration:12,creatorStateFingerprint:"creator-state-fingerprint-schema-2",creatorStateOwnershipRef:"creator-state-ownership-schema-2",creatorStateOwnershipRevision:13,stagedAt:new Date("2031-12-31T23:59:59.000Z")};
const rows = new Map([["movie_mentor_inference_execution",execution],["movie_mentor_canonical_result",result],["movie_mentor_result_candidate",candidate]]);
const database={collection(name){return{async findOne(){return structuredClone(rows.get(name)||null);}};}};
const session={async withTransaction(fn){return fn();},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>database,now:()=>new Date("2032-01-01T00:00:01.000Z")});
const outcome=await store.settleCanonicalResult({executionId:execution.executionId});
assert.equal(outcome.reason,"canonical-result-finalization-binding-invalid",`current schema-${candidateStatus.schema} proof-bearing result candidate must cross settlement candidate validation and reach the deliberately later finalization fence; got ${outcome.reason}`);
console.log("✓ settlement accepts the exact proof-bearing result-candidate schema emitted by the current candidate store");
console.log("✓ verifier reaches the later finalization fence, proving candidate-schema validation did not reject current durable reality");
console.log("LAW: CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED");
console.log("5A.27 result-candidate schema settlement authority torture: GREEN");
