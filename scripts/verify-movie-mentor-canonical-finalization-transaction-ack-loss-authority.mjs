import assert from "node:assert/strict";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";

const record={resultReference:"result-ack",candidateReference:"candidate-ack",executionId:"exec-ack",creatorTurnId:"turn-ack",principalId:"creator-ack",projectId:"project-ack",reservationId:"reservation-ack",requestDigest:"request-ack",closureReference:"closure-ack",closureCertificateDigest:"certificate-ack",resultDigest:"4062edaf750fb8074e7e83e0c9028c94e32468a8b977ef8c6a0a8c05bceaf96f",resultPayload:{ok:true},committedAt:"2034-01-01T00:00:00.000Z"};
const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,...record,phase:"closed",leaseGeneration:1,leaseReference:"lease-ack",fencingToken:"fence-ack",providerEffectRealityRevision:0};
const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,...record,stagedFromLeaseGeneration:1,stagedFromLeaseReference:"lease-ack",stagedFromFencingToken:"fence-ack",creatorStateRevision:1,creatorStateGeneration:1,creatorStateOwnershipRevision:1,creatorStateFingerprint:"fingerprint",creatorStateOwnershipRef:"ownership",creatorStateOwnershipRevision:1,resultPayload:{ok:true},stagedAt:new Date("2034-01-01T00:00:00.000Z")};
let canonical=null;
const query=()=>({session(){return this},lean(){return this},async exec(){return canonical}});
const mongoModel={
 findOne(){return query()},
 async create(rows){canonical={domain:"iband.movie-mentor.canonical-result-store",schema:2,...structuredClone(rows[0])};return [canonical]}
};
const executionCollection={
 async findOne(){return execution},
 async updateOne(){execution.phase="finalized";execution.finalizedResultReference=record.resultReference;execution.finalizedCandidateReference=record.candidateReference;execution.finalizedResultDigest=record.resultDigest;execution.resultFinalizedAt=new Date(record.committedAt);return {matchedCount:1}}
};
const candidateCollection={async findOne(){return candidate}};
const session={async withTransaction(fn){await fn();throw Object.assign(new Error("simulated commit acknowledgement loss"),{code:"UNKNOWN_TRANSACTION_COMMIT_RESULT"})},async endSession(){}};
const indexes=[
 {key:{resultReference:1},unique:true},{key:{candidateReference:1},unique:true},{key:{executionId:1},unique:true},{key:{principalId:1,projectId:1,creatorTurnId:1},unique:true},{key:{reservationId:1},unique:true}
];
const readIndexes=async name=>name==="movie_mentor_inference_execution"?[{key:{executionId:1},unique:true}]:name==="movie_mentor_result_candidate"?[{key:{executionId:1},unique:true},{key:{candidateReference:1},unique:true}]:indexes;
const store=createMovieMentorCanonicalResultMongoStore({mongoModel,startSession:async()=>session,executionCollection,candidateCollection,readIndexes});
const result=await store.commit(record,{expectedProviderEffectRealityRevision:0});
assert.equal(result.resultReference,record.resultReference,"committed canonical reality must survive transaction acknowledgement loss");
assert.equal(execution.phase,"finalized");
console.log("Movie Mentor canonical finalization transaction ack-loss authority: GREEN");
console.log("LAW: A LOST TRANSACTION ACK MUST RECONCILE DURABLE CANONICAL FINALIZATION BEFORE REPORTING FAILURE.");
