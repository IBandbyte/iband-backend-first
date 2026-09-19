import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";

console.log("Movie Mentor settlement current entitlement status authority court");

const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;};
const stableDigest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const resultPayload={response:"canonical"};
const resultDigest=stableDigest(resultPayload);
const frozenProviderCallSetDigest=digest([]);
const certificate={
  executionId:"execution-A",
  creatorTurnId:"turn-A",
  principalId:"creator-A",
  projectId:"project-A",
  reservationId:"reservation-A",
  requestDigest:"request-A",
  closureReference:"closure-A",
  frozenProviderCallSetDigest,
  closurePolicyVersion:"policy-A",
  realities:[],
};
const closureCertificateDigest=digest(certificate);

const execution={
  domain:"iband.movie-mentor.inference-execution-store",schema:6,
  executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",
  reservationId:"reservation-A",requestDigest:"request-A",phase:"finalized",
  closureReference:"closure-A",closureCertificateDigest,closurePolicyVersion:"policy-A",
  finalizedResultReference:"result-A",finalizedCandidateReference:"candidate-A",finalizedResultDigest:resultDigest,
  resultFinalizedAt:"2036-01-01T23:59:00.000Z",
  providerCalls:[],providerCallsClaimed:0,frozenProviderCallCount:0,frozenProviderCallSetDigest,
  providerEffectRealityRevision:0,
};
const result={
  domain:"iband.movie-mentor.canonical-result-store",schema:2,
  executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",projectId:"project-A",
  reservationId:"reservation-A",requestDigest:"request-A",closureReference:"closure-A",
  closureCertificateDigest,resultReference:"result-A",candidateReference:"candidate-A",
  resultDigest,resultPayload,
};
const candidate={
  domain:"iband.movie-mentor.result-candidate-store",schema:2,
  candidateReference:"candidate-A",executionId:"execution-A",creatorTurnId:"turn-A",principalId:"creator-A",
  projectId:"project-A",reservationId:"reservation-A",requestDigest:"request-A",resultDigest,resultPayload,
  stagedFromLeaseReference:"lease-A",stagedFromFencingToken:"fence-A",stagedFromLeaseGeneration:1,
  creatorStateFingerprint:"fingerprint-A",creatorStateOwnershipRef:"ownership-A",
  creatorStateRevision:1,creatorStateGeneration:1,creatorStateOwnershipRevision:1,
  stagedAt:"2036-01-01T23:58:00.000Z",
};
execution.leaseReference="lease-A";
execution.fencingToken="fence-A";
execution.leaseGeneration=1;

const reservation={
  domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-A",
  principalId:"creator-A",projectId:"project-A",operation:"movie-mentor-turn",units:2,status:"reserved",
};
const suspendedEntitlement={
  domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-A",
  status:"suspended",remainingUnits:8,reservedUnits:2,consumedUnits:3,entitlementRevision:7,
};
let entitlementMutationCalls=0;
const consumedReservation={...reservation,status:"consumed",settledAt:"2036-01-02T00:00:00.000Z",
  settlementReason:"canonical-result:result-A",settlementExecutionId:"execution-A",
  settlementResultReference:"result-A",settlementCandidateReference:"candidate-A",settlementResultDigest:resultDigest};

const collection=name=>{
  if(name==="movie_mentor_inference_execution")return {findOne:async()=>structuredClone(execution),updateOne:async()=>({matchedCount:1})};
  if(name==="movie_mentor_canonical_result")return {findOne:async()=>structuredClone(result)};
  if(name==="movie_mentor_result_candidate")return {findOne:async()=>structuredClone(candidate)};
  if(name==="movie_mentor_provider_effect_reality")return {find:()=>({toArray:async()=>[]})};
  if(name==="movie_mentor_inference_spend_reservation")return {findOne:async()=>structuredClone(reservation),findOneAndUpdate:async()=>structuredClone(consumedReservation)};
  if(name==="movie_mentor_inference_entitlement")return {findOneAndUpdate:async()=>{entitlementMutationCalls+=1;return structuredClone(suspendedEntitlement)}};
  return {};
};
const session={async withTransaction(fn){await fn()},async endSession(){}};
const store=createMovieMentorInferenceSettlementMongoStore({
  connect:async()=>{},db:()=>({collection}),startSession:async()=>session,
  now:()=>new Date("2036-01-02T00:00:00.000Z"),
});

const outcome=await store.settleCanonicalResult({executionId:"execution-A"});
assert.equal(entitlementMutationCalls,0,"suspended current entitlement must stop before settlement debit mutation");
assert.equal(outcome?.authorized,false,"suspended current entitlement must not authorize settlement");
console.log("GREEN: fresh settlement requires current active entitlement authority before irreversible debit.");
