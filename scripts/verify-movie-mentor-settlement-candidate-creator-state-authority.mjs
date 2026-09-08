import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("5A.29 — settlement candidate creator-state authority torture");

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const payload={success:true,mentorResponse:{text:"Candidate provenance must survive every irreversible boundary."}};
const resultDigest=digest(payload);
const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"finalized",executionId:"execution-candidate-provenance",creatorTurnId:"turn-candidate-provenance",principalId:"creator-candidate-provenance",projectId:"project-candidate-provenance",reservationId:"reservation-candidate-provenance",requestDigest:"request-candidate-provenance",closureReference:"closure-candidate-provenance",closureCertificateDigest:"closure-digest-candidate-provenance",finalizedResultReference:"deliberately-wrong-result-reference",finalizedCandidateReference:"candidate-candidate-provenance",finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:00:00.000Z")};
const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:execution.closureCertificateDigest,resultReference:"result-candidate-provenance",candidateReference:"candidate-candidate-provenance",resultDigest,resultPayload:payload};
// This row claims the current schema but has had every creator-state and live-staging
// provenance field stripped. A current-schema label must not manufacture authority.
const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:"candidate-candidate-provenance",executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload};
const rows=new Map([["movie_mentor_inference_execution",execution],["movie_mentor_canonical_result",result],["movie_mentor_result_candidate",candidate]]);
const database={collection(name){return{async findOne(){return structuredClone(rows.get(name)||null);}};}};
const session={async withTransaction(fn){return fn();},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>database,now:()=>new Date("2032-01-01T00:00:01.000Z")});
const outcome=await store.settleCanonicalResult({executionId:execution.executionId});
assert.equal(outcome.reason,"canonical-result-candidate-lineage-invalid",`schema-2 candidate stripped of creator-state/live-staging provenance must fail at candidate authority before finalization; got ${outcome.reason}`);
console.log("✓ settlement rejects a current-schema candidate whose creator-state and live-staging provenance was stripped");
console.log("LAW: A CURRENT SCHEMA LABEL IS NOT AUTHORITY; THE PROOF-BEARING FIELDS OWNED BY THAT SCHEMA MUST CROSS THE IRREVERSIBLE BOUNDARY.");
console.log("5A.29 settlement candidate creator-state authority torture: GREEN");
