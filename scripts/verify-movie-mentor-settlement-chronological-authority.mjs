import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor settlement chronological authority court");

const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;};
const stableDigest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const resultPayload={response:"canonical"},resultDigest=stableDigest(resultPayload),frozenProviderCallSetDigest=digest([]);
const certificate={executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",frozenProviderCallSetDigest,closurePolicyVersion:"policy-A",realities:[]};
const closureCertificateDigest=digest(certificate);
let execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",phase:"finalized",closureReference:"closure-A",closureCertificateDigest,closurePolicyVersion:"policy-A",finalizedResultReference:"result-A",finalizedCandidateReference:"candidate-A",finalizedResultDigest:resultDigest,resultFinalizedAt:"2036-01-02T00:01:00.000Z",providerCalls:[],providerCallsClaimed:0,frozenProviderCallCount:0,frozenProviderCallSetDigest,providerEffectRealityRevision:0,leaseReference:"lease-A",fencingToken:"fence-A",leaseGeneration:1};
const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",closureCertificateDigest,resultReference:"result-A",candidateReference:"candidate-A",resultDigest,resultPayload};
const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:"candidate-A",executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",resultDigest,resultPayload,stagedFromLeaseReference:"lease-A",stagedFromFencingToken:"fence-A",stagedFromLeaseGeneration:1,creatorStateFingerprint:"fingerprint-A",creatorStateOwnershipRef:"ownership-A",creatorStateRevision:1,creatorStateGeneration:1,creatorStateOwnershipRevision:1,stagedAt:"2036-01-01T23:58:00.000Z"};
let reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-A",principalId:"creator-A",projectId:"project-A",operation:"movie-mentor-turn",units:2,status:"reserved"};
let entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-A",status:"active",remainingUnits:8,reservedUnits:2,consumedUnits:0,entitlementRevision:1};
const firstAttemptAt="2036-01-02T00:00:00.000Z",secondAttemptAt="2036-01-02T00:00:05.000Z";let settledAt=firstAttemptAt;
const collection=name=>{
 if(name==="movie_mentor_inference_execution")return {findOne:async()=>structuredClone(execution),updateOne:async()=>{execution={...execution,phase:"settled",settledResultReference:"result-A",settledCandidateReference:"candidate-A",settledResultDigest:resultDigest,settledAt,settlementRealityBarrierRevision:1};return {matchedCount:1}}};
 if(name==="movie_mentor_canonical_result")return {findOne:async()=>structuredClone(result)};
 if(name==="movie_mentor_result_candidate")return {findOne:async()=>structuredClone(candidate)};
 if(name==="movie_mentor_provider_effect_reality")return {find:()=>({toArray:async()=>[]})};
 if(name==="movie_mentor_inference_entitlement")return {findOneAndUpdate:async()=>{entitlement={...entitlement,reservedUnits:0,consumedUnits:2,entitlementRevision:2};return structuredClone(entitlement)}};
 if(name==="movie_mentor_inference_spend_reservation")return {findOne:async()=>structuredClone(reservation),findOneAndUpdate:async()=>{reservation={...reservation,status:"consumed",settledAt,settlementReason:"canonical-result:result-A",settlementExecutionId:"execution-A",settlementResultReference:"result-A",settlementCandidateReference:"candidate-A",settlementResultDigest:resultDigest};return structuredClone(reservation)}};
 return {};
};
let transactionAttempts=0;
const transient=Object.assign(new Error("transient transaction"),{errorLabels:["TransientTransactionError"],hasErrorLabel(label){return this.errorLabels.includes(label)}});
const session={async withTransaction(fn){transactionAttempts+=1;settledAt=transactionAttempts===1?firstAttemptAt:secondAttemptAt;try{await fn();if(transactionAttempts===1){execution={...execution,phase:"finalized",settledResultReference:undefined,settledCandidateReference:undefined,settledResultDigest:undefined,settledAt:undefined,settlementRealityBarrierRevision:undefined};reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-A",principalId:"creator-A",projectId:"project-A",operation:"movie-mentor-turn",units:2,status:"reserved"};entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-A",status:"active",remainingUnits:8,reservedUnits:2,consumedUnits:0,entitlementRevision:1};throw transient}}catch(error){if(error?.hasErrorLabel?.("TransientTransactionError")&&transactionAttempts===1)return this.withTransaction(fn);throw error}},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({connect:async()=>{},db:()=>({collection}),startSession:async()=>session,now:()=>new Date(settledAt)});
await assert.rejects(()=>store.settleCanonicalResult({executionId:"execution-A"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_TIME_INVALID"||error?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_REALITY_RACE","settlement must fail closed when newly minted settlement time precedes durable canonical finalization");
const outcome=null;
console.log("GREEN: settlement chronology rejects a settlement instant that precedes durable canonical finalization.");
