import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";

const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;};
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const physicalIndexes=[{key:{resultReference:1},unique:true},{key:{candidateReference:1},unique:true},{key:{executionId:1},unique:true},{key:{principalId:1,projectId:1,creatorTurnId:1},unique:true},{key:{reservationId:1},unique:true}];
const payload={success:true,mentorResponse:{text:"Legacy canonical history may not acquire new FINALIZED authority."}},resultDigest=digest(payload);
const record={resultReference:"result-legacy-existing",candidateReference:"candidate-current",executionId:"execution-legacy-existing",creatorTurnId:"turn-legacy-existing",principalId:"creator-legacy-existing",projectId:"project-legacy-existing",reservationId:"reservation-legacy-existing",requestDigest:"request-legacy-existing",closureReference:"closure-legacy-existing",closureCertificateDigest:"closure-digest-legacy-existing",resultDigest,resultPayload:stable(payload),committedAt:"2032-01-01T00:00:00.000Z"};
const legacyCanonical={domain:"iband.movie-mentor.canonical-result-store",schema:1,resultReference:record.resultReference,executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,closureReference:record.closureReference,closureCertificateDigest:record.closureCertificateDigest,resultDigest,resultPayload:stable(payload),committedAt:new Date("2031-12-31T23:59:58.000Z")};
let canonicalRow=structuredClone(legacyCanonical);
const model={findOne(query){return{session(){return this;},lean(){return this;},async exec(){if(query.executionId&&canonicalRow.executionId!==query.executionId)return null;if(query.principalId&&canonicalRow.principalId!==query.principalId)return null;if(query.projectId&&canonicalRow.projectId!==query.projectId)return null;if(query.creatorTurnId&&canonicalRow.creatorTurnId!==query.creatorTurnId)return null;return structuredClone(canonicalRow);}};},async create(){throw new Error("pre-existing legacy row must prevent current insert");}};
let executionRow={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"closed",providerEffectRealityRevision:7,executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,leaseGeneration:8,leaseReference:"lease-current",fencingToken:"fence-current",closureReference:record.closureReference,closureCertificateDigest:record.closureCertificateDigest,resultFinalizationBarrierRevision:0};
const candidateRow={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:record.candidateReference,executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,resultDigest,resultPayload:stable(payload),stagedFromLeaseGeneration:8,stagedFromLeaseReference:"lease-current",stagedFromFencingToken:"fence-current",creatorStateRevision:12,creatorStateGeneration:5,creatorStateFingerprint:"creator-state-current",creatorStateOwnershipRef:"ownership-current",creatorStateOwnershipRevision:3,stagedAt:"2031-12-31T23:59:59.000Z"};
let finalizationWrites=0;
const executionCollection={async findOne(){return structuredClone(executionRow);},async updateOne(_filter,update){finalizationWrites++;executionRow={...executionRow,...structuredClone(update.$set),resultFinalizationBarrierRevision:executionRow.resultFinalizationBarrierRevision+1};return{matchedCount:1};}};
const candidateCollection={async findOne(){return structuredClone(candidateRow);}};
const session={async withTransaction(fn){return fn();},async endSession(){}};
const store=createMovieMentorCanonicalResultMongoStore({mongoModel:model,executionCollection,candidateCollection,startSession:async()=>session,readIndexes:async()=>physicalIndexes});
let error=null;try{await store.commit(record,{expectedProviderEffectRealityRevision:7});}catch(value){error=value;}
assert.ok(error,"pre-existing legacy canonical row must fail closed instead of borrowing current candidate authority");
assert.equal(error.code,"MOVIE_MENTOR_CANONICAL_RESULT_CONFLICT");
assert.equal(executionRow.phase,"closed","legacy canonical history must not promote current execution to FINALIZED");
assert.equal(finalizationWrites,0,"legacy canonical history must be rejected before the irreversible finalization write");
assert.equal(canonicalRow.schema,1,"historical row may remain readable history without being rewritten into current authority");
console.log("GREEN: pre-existing legacy canonical history cannot borrow a current candidate's proof-bearing provenance to acquire FINALIZED authority.");
console.log("LAW: A LEGACY CANONICAL ROW MAY SURVIVE AS HISTORY. IT MAY NOT BORROW CURRENT CANDIDATE AUTHORITY OR CROSS CLOSED -> FINALIZED.");
