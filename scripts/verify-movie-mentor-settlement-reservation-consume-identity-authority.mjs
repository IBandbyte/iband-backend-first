import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor settlement reservation consume identity authority court");

const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;};
const stableDigest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const resultPayload={response:"canonical"};
const resultDigest=stableDigest(resultPayload);
const frozenProviderCallSetDigest=digest([]);
const certificate={executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",frozenProviderCallSetDigest,closurePolicyVersion:"policy-A",realities:[]};
const closureCertificateDigest=digest(certificate);
const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",phase:"finalized",closureReference:"closure-A",closureCertificateDigest,closurePolicyVersion:"policy-A",finalizedResultReference:"result-A",finalizedCandidateReference:"candidate-A",finalizedResultDigest:resultDigest,resultFinalizedAt:"2036-01-01T23:59:00.000Z",providerCalls:[],providerCallsClaimed:0,frozenProviderCallCount:0,frozenProviderCallSetDigest,providerEffectRealityRevision:0,leaseReference:"lease-A",fencingToken:"fence-A",leaseGeneration:1};
const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",closureCertificateDigest,resultReference:"result-A",candidateReference:"candidate-A",resultDigest,resultPayload};
const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:"candidate-A",executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",resultDigest,resultPayload,stagedFromLeaseReference:"lease-A",stagedFromFencingToken:"fence-A",stagedFromLeaseGeneration:1,creatorStateFingerprint:"fingerprint-A",creatorStateOwnershipRef:"ownership-A",creatorStateRevision:1,creatorStateGeneration:1,creatorStateOwnershipRevision:1,stagedAt:"2036-01-01T23:58:00.000Z"};
const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-A",principalId:"creator-A",projectId:"project-A",operation:"movie-mentor-turn",units:2,status:"reserved"};
const validEntitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-A",status:"active",remainingUnits:8,reservedUnits:0,consumedUnits:2,entitlementRevision:2};
const counterfeitReservation={...reservation,reservationId:"reservation-EVIL",principalId:"creator-EVIL",projectId:"project-EVIL",status:"released",settledAt:"1999-01-01T00:00:00.000Z",settlementReason:"counterfeit",settlementExecutionId:"execution-EVIL",settlementResultReference:"result-EVIL",settlementCandidateReference:"candidate-EVIL",settlementResultDigest:"digest-EVIL"};
const collection=name=>{
 if(name==="movie_mentor_inference_execution")return {findOne:async()=>structuredClone(execution),updateOne:async()=>({matchedCount:1})};
 if(name==="movie_mentor_canonical_result")return {findOne:async()=>structuredClone(result)};
 if(name==="movie_mentor_result_candidate")return {findOne:async()=>structuredClone(candidate)};
 if(name==="movie_mentor_provider_effect_reality")return {find:()=>({toArray:async()=>[]})};
 if(name==="movie_mentor_inference_spend_reservation")return {findOne:async()=>structuredClone(reservation),findOneAndUpdate:async()=>structuredClone(counterfeitReservation)};
 if(name==="movie_mentor_inference_entitlement")return {findOneAndUpdate:async()=>structuredClone(validEntitlement)};
 return {};
};
const session={async withTransaction(fn){await fn()},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},db:()=>({collection}),startSession:async()=>session,now:()=>new Date("2036-01-02T00:00:00.000Z")});
await assert.rejects(()=>store.settleCanonicalResult({executionId:"execution-A"}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_RESERVATION_RACE","successful consumed reservation write return must bind exact reservation identity, principal/project, consumed state, exact settlement instant and canonical lineage");
console.log("GREEN: consumed reservation write return binds exact durable settlement identity and canonical lineage.");
