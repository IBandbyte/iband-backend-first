import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("5A.29 — settlement candidate creator-state authority torture");

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const payload={success:true,mentorResponse:{text:"Candidate provenance must survive every irreversible boundary."}};
const resultDigest=digest(payload);
const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"finalized",executionId:"execution-candidate-provenance",creatorTurnId:"turn-candidate-provenance",principalId:"creator-candidate-provenance",projectId:"project-candidate-provenance",reservationId:"reservation-candidate-provenance",requestDigest:"request-candidate-provenance",leaseGeneration:7,leaseReference:"lease-candidate-provenance",fencingToken:"fence-candidate-provenance",closureReference:"closure-candidate-provenance",closureCertificateDigest:"closure-digest-candidate-provenance",finalizedResultReference:"deliberately-wrong-result-reference",finalizedCandidateReference:"candidate-candidate-provenance",finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:00:00.000Z")};
const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:execution.closureCertificateDigest,resultReference:"result-candidate-provenance",candidateReference:"candidate-candidate-provenance",resultDigest,resultPayload:payload};
const strippedCandidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:"candidate-candidate-provenance",executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload};
const proofBearingCandidate={...strippedCandidate,stagedFromLeaseGeneration:execution.leaseGeneration,stagedFromLeaseReference:execution.leaseReference,stagedFromFencingToken:execution.fencingToken,creatorStateRevision:11,creatorStateGeneration:12,creatorStateFingerprint:"creator-state-fingerprint-candidate-provenance",creatorStateOwnershipRef:"creator-state-ownership-candidate-provenance",creatorStateOwnershipRevision:13,stagedAt:new Date("2031-12-31T23:59:59.000Z")};

async function reasonFor(candidate){
  const rows=new Map([["movie_mentor_inference_execution",execution],["movie_mentor_canonical_result",result],["movie_mentor_result_candidate",candidate]]);
  const database={collection(name){return{async findOne(){return structuredClone(rows.get(name)||null);}};}};
  const session={async withTransaction(fn){return fn();},async endSession(){}};
  const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>database,now:()=>new Date("2032-01-01T00:00:01.000Z")});
  return (await store.settleCanonicalResult({executionId:execution.executionId})).reason;
}

const strippedReason=await reasonFor(strippedCandidate);
assert.equal(strippedReason,"canonical-result-candidate-lineage-invalid",`schema-2 candidate stripped of creator-state/live-staging provenance must fail at candidate authority before finalization; got ${strippedReason}`);
const proofBearingReason=await reasonFor(proofBearingCandidate);
assert.equal(proofBearingReason,"canonical-result-finalization-binding-invalid",`proof-bearing schema-2 candidate must cross candidate authority and reach the deliberately later finalization fence; got ${proofBearingReason}`);
console.log("✓ settlement rejects a current-schema candidate whose creator-state and live-staging provenance was stripped");
console.log("✓ settlement admits the exact proof-bearing candidate shape far enough to reach the later finalization fence");
console.log("LAW: A CURRENT SCHEMA LABEL IS NOT AUTHORITY; THE PROOF-BEARING FIELDS OWNED BY THAT SCHEMA MUST CROSS THE IRREVERSIBLE BOUNDARY.");
console.log("5A.29 settlement candidate creator-state authority torture: GREEN");
