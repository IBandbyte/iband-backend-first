import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementMongoStore, getMovieMentorInferenceSettlementMongoStoreStatus } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { getMovieMentorInferenceExecutionMongoStoreStatus } from "../ai/MovieMentorInferenceExecutionMongoStore.js";

console.log("5A.29 — execution schema settlement authority torture");

const executionStatus=getMovieMentorInferenceExecutionMongoStoreStatus();
const settlementStatus=getMovieMentorInferenceSettlementMongoStoreStatus();
assert.equal(executionStatus.schema,6,"verifier must target the schema actually emitted by the current inference-execution store");
assert.match(settlementStatus.executionSchemaCompatibility,/^6-settlement;/,"settlement status must advertise current-schema-only debit authority");

async function settlementReasonFor(executionSchema){
  const execution={domain:"iband.movie-mentor.inference-execution-store",schema:executionSchema,phase:"finalized",executionId:`execution-schema-${executionSchema}`,creatorTurnId:`turn-execution-schema-${executionSchema}`,principalId:"creator-execution-schema",projectId:"project-execution-schema",reservationId:`reservation-execution-schema-${executionSchema}`,requestDigest:"request-execution-schema",closureReference:"closure-execution-schema",closureCertificateDigest:"closure-execution-schema-digest",finalizedResultReference:"result-execution-schema",finalizedCandidateReference:"candidate-execution-schema",finalizedResultDigest:"result-digest-execution-schema",resultFinalizedAt:new Date("2032-01-01T00:00:00.000Z")};
  const rows=new Map([["movie_mentor_inference_execution",execution]]);const database={collection(name){return{async findOne(){return structuredClone(rows.get(name)||null);}};}};const session={async withTransaction(fn){return fn();},async endSession(){}};const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>database,now:()=>new Date("2032-01-01T00:00:01.000Z")});return (await store.settleCanonicalResult({executionId:execution.executionId})).reason;
}

const currentReason=await settlementReasonFor(executionStatus.schema);
assert.equal(currentReason,"canonical-result-binding-invalid",`current execution schema-${executionStatus.schema} must cross execution schema validation and reach the deliberately later canonical-result fence; got ${currentReason}`);
const legacyReason=await settlementReasonFor(5);
assert.equal(legacyReason,"execution-binding-invalid",`legacy execution schema must fail closed at settlement before canonical-result/debit authority; got ${legacyReason}`);
console.log(`✓ current execution schema-${executionStatus.schema} crosses settlement execution validation`);
console.log("✓ legacy execution schema is denied authority at the irreversible settlement boundary");
console.log("✓ settlement status advertises current-schema-only debit authority");
console.log("LAW: CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED");
console.log("5A.29 execution schema settlement authority torture: GREEN");
