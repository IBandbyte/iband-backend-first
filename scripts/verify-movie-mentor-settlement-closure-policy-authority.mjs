import assert from "node:assert/strict";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"finalized",executionId:"execution-settlement-policy",creatorTurnId:"turn-settlement-policy",principalId:"creator-settlement-policy",projectId:"project-settlement-policy",reservationId:"reservation-settlement-policy",requestDigest:"request-settlement-policy",closureReference:"closure-settlement-policy",closureCertificateDigest:"closure-digest-settlement-policy",closurePolicyVersion:"superseded-policy",finalizedResultReference:"result-settlement-policy",finalizedCandidateReference:"candidate-settlement-policy",finalizedResultDigest:"digest-settlement-policy",resultFinalizedAt:new Date("2032-01-01T00:00:00.000Z")};
const rows=new Map([["movie_mentor_inference_execution",execution]]);
const database={collection(name){return{async findOne(){return structuredClone(rows.get(name)||null);}};}};
const session={async withTransaction(fn){return fn();},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},startSession:async()=>session,db:()=>database,now:()=>new Date("2032-01-01T00:00:01.000Z")});
const outcome=await store.settleCanonicalResult({executionId:execution.executionId});
assert.equal(outcome.authorized,false,"superseded closure policy must not retain settlement authority");
assert.equal(outcome.reason,"execution-binding-invalid","superseded closure policy must fail at execution authority before canonical/debit fences");
console.log("GREEN: superseded closure policy cannot cross FINALIZED -> SETTLED authority.");
console.log("LAW: A FINALIZED RECORD FROM A SUPERSEDED CLOSURE POLICY MAY REMAIN HISTORY. IT MAY NOT CROSS THE CURRENT SETTLEMENT BOUNDARY.");