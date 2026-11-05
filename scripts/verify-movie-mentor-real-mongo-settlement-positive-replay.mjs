import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import {createMovieMentorInferenceSettlementPhysicalAuthority,MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//,"Disposable local Mongo URI required");
process.env.MONGO_URI=uri;
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const stableDigest=value=>digest(stable(value));
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try{
 const db=mongoose.connection.db;
 for(const requirement of MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES)
  await db.collection(requirement.collection).createIndex(requirement.key,{unique:true});
 const authority=createMovieMentorInferenceSettlementPhysicalAuthority({
  store:createMovieMentorInferenceSettlementMongoStore(),
  readIndexes:collection=>db.collection(collection).indexes()
 });
 const executionId="physical-positive-execution",creatorTurnId="physical-positive-turn",principalId="physical-positive-owner",projectId="physical-positive-project",reservationId="physical-positive-reservation",requestDigest="physical-positive-request";
 const resultReference="physical-positive-result",candidateReference="physical-positive-candidate",closureReference="physical-positive-closure",leaseReference="physical-positive-lease",fencingToken="physical-positive-fence";
 const resultPayload={text:"verified rollback fixture"},resultDigest=stableDigest(resultPayload);
 const frozenProviderCallSetDigest=digest([]);
 const certificate={executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,closureReference,frozenProviderCallSetDigest,closurePolicyVersion:"physical-positive-policy",realities:[]};
 const closureCertificateDigest=digest(certificate);
 const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,phase:"finalized",leaseGeneration:1,leaseReference,fencingToken,providerCallsClaimed:0,providerCalls:[],frozenProviderCallCount:0,frozenProviderCallSetDigest,closureReference,closurePolicyVersion:certificate.closurePolicyVersion,closureCertificateDigest,providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,finalizedResultReference:resultReference,finalizedCandidateReference:candidateReference,finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:03:00.000Z")};
 const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,closureReference,closureCertificateDigest,resultReference,candidateReference,resultDigest,resultPayload};
 const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,resultDigest,resultPayload,stagedFromLeaseGeneration:1,stagedFromLeaseReference:leaseReference,stagedFromFencingToken:fencingToken,creatorStateFingerprint:"physical-positive-state",creatorStateOwnershipRef:"physical-positive-ownership",creatorStateRevision:0,creatorStateGeneration:1,creatorStateOwnershipRevision:1,stagedAt:new Date("2032-01-01T00:02:00.000Z")};
 const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId,projectId,operation:"movie-mentor-turn",status:"reserved",units:2};
 const entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId,reservedUnits:2,consumedUnits:0,remainingUnits:3,entitlementRevision:1};
 const collections={execution:"movie_mentor_inference_execution",result:"movie_mentor_canonical_result",candidate:"movie_mentor_result_candidate",reservation:"movie_mentor_inference_spend_reservation",entitlement:"movie_mentor_inference_entitlement"};
 for(const [key,row] of Object.entries({execution,result,candidate,reservation,entitlement}))await db.collection(collections[key]).insertOne(row);
 const snapshot=async()=>({
  execution:await db.collection(collections.execution).findOne({executionId},{projection:{_id:0}}),
  reservation:await db.collection(collections.reservation).findOne({reservationId},{projection:{_id:0}}),
  entitlement:await db.collection(collections.entitlement).findOne({principalId},{projection:{_id:0}})
 });
 const before=await snapshot();
 assert.equal(before.execution.phase,"finalized");
 assert.equal(before.reservation.status,"reserved");
 assert.equal(before.entitlement.reservedUnits,2);
 const first=await authority.settleCanonicalResult({executionId});
 assert.equal(first.settled,true,"First physical settlement must succeed");
 assert.equal(first.authorized,true);
 assert.equal(first.idempotent,false,"First physical settlement must be a new debit");
 assert.equal(first.explicitDebitBindingVerified,true);
 const after=await snapshot();
 assert.equal(after.execution.phase,"settled");
 assert.equal(after.execution.settledResultReference,resultReference);
 assert.equal(after.execution.settledCandidateReference,candidateReference);
 assert.equal(after.execution.settledResultDigest,resultDigest);
 assert.equal(after.reservation.status,"consumed");
 assert.equal(after.reservation.settlementExecutionId,executionId);
 assert.equal(after.reservation.settlementResultReference,resultReference);
 assert.equal(after.reservation.settlementCandidateReference,candidateReference);
 assert.equal(after.reservation.settlementResultDigest,resultDigest);
 assert.equal(after.entitlement.reservedUnits,0);
 assert.equal(after.entitlement.consumedUnits,2);
 assert.equal(after.entitlement.remainingUnits,3);
 assert.equal(after.entitlement.entitlementRevision,2);
 const replay=await authority.settleCanonicalResult({executionId});
 assert.equal(replay.settled,true);
 assert.equal(replay.authorized,true);
 assert.equal(replay.idempotent,true,"Replay must be an idempotent exact-lineage settlement");
 assert.deepEqual(await snapshot(),after,"Replay must not change any execution or financial record");
 console.log("GREEN: disposable real Mongo settlement consumed two reserved units exactly once, bound canonical lineage to execution and reservation, and replay preserved all durable records without a second debit. Concurrent settlement and HTTP remain uncertified.");
}finally{await mongoose.disconnect();}
