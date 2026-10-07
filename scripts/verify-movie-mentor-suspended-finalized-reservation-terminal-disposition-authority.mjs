import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import {createMovieMentorTerminalDispositionDecisionMongoStore} from "../ai/MovieMentorTerminalDispositionDecisionMongoStore.js";

const EXECUTION_DOMAIN="iband.movie-mentor.inference-execution-store";
const RESULT_DOMAIN="iband.movie-mentor.canonical-result-store";
const CANDIDATE_DOMAIN="iband.movie-mentor.result-candidate-store";
const SPEND_DOMAIN="iband.movie-mentor.inference-spend";
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const stableDigest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const uri=process.env.MONGO_URI;
assert.ok(uri,"MONGO_URI required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=mongoose.connection.db;
for(const name of ["movie_mentor_inference_execution","movie_mentor_canonical_result","movie_mentor_result_candidate","movie_mentor_inference_spend_reservation","movie_mentor_inference_entitlement","movie_mentor_provider_effect_reality","movie_mentor_provider_operation","movie_mentor_terminal_disposition_decision"])await db.collection(name).deleteMany({});

const id="terminal-disposition";
const payload={success:true,text:"canonical-no-effect"};
const resultDigest=stableDigest(payload);
const certificate={executionId:`execution-${id}`,creatorTurnId:`turn-${id}`,principalId:`creator-${id}`,projectId:`project-${id}`,reservationId:`reservation-${id}`,requestDigest:`request-${id}`,closureReference:`closure-${id}`,frozenProviderCallSetDigest:digest([]),closurePolicyVersion:"policy-417",realities:[]};
const certificateDigest=digest(certificate);
const execution={domain:EXECUTION_DOMAIN,schema:6,executionId:certificate.executionId,creatorTurnId:certificate.creatorTurnId,principalId:certificate.principalId,projectId:certificate.projectId,reservationId:certificate.reservationId,requestDigest:certificate.requestDigest,phase:"finalized",ownerId:"owner-417",leaseGeneration:1,leaseReference:"lease-417",fencingToken:"fence-417",providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:1,closureReference:certificate.closureReference,frozenProviderCallCount:0,frozenProviderCallSetDigest:digest([]),closurePolicyVersion:"policy-417",closureCertificateDigest:certificateDigest,finalizedResultReference:"result-417",finalizedCandidateReference:"candidate-417",finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:04:00.000Z")};
const candidate={domain:CANDIDATE_DOMAIN,schema:2,candidateReference:"candidate-417",executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,resultDigest,resultPayload:payload,stagedFromLeaseReference:execution.leaseReference,stagedFromFencingToken:execution.fencingToken,stagedFromLeaseGeneration:1,creatorStateFingerprint:"state-417",creatorStateOwnershipRef:"ownership-417",creatorStateRevision:1,creatorStateGeneration:1,creatorStateOwnershipRevision:1,stagedAt:new Date("2032-01-01T00:03:00.000Z")};
const result={domain:RESULT_DOMAIN,schema:2,resultReference:"result-417",executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:execution.closureReference,closureCertificateDigest:certificateDigest,candidateReference:candidate.candidateReference,resultDigest,resultPayload:payload,committedAt:new Date("2032-01-01T00:04:00.000Z")};
const reservation={domain:SPEND_DOMAIN,schema:1,reservationId:execution.reservationId,principalId:execution.principalId,projectId:execution.projectId,operation:"movie-mentor-turn",units:2,status:"reserved",entitlementRevision:9};
const entitlement={domain:SPEND_DOMAIN,schema:1,principalId:execution.principalId,status:"suspended",remainingUnits:5,reservedUnits:2,consumedUnits:3,entitlementRevision:10};

await db.collection("movie_mentor_inference_execution").insertOne(execution);
await db.collection("movie_mentor_canonical_result").insertOne(result);
await db.collection("movie_mentor_result_candidate").insertOne(candidate);
await db.collection("movie_mentor_inference_spend_reservation").insertOne(reservation);
await db.collection("movie_mentor_inference_entitlement").insertOne(entitlement);

const store=createMovieMentorInferenceSettlementMongoStore({now:()=>new Date("2032-01-01T00:05:00.000Z")});

const settlement=await store.settleCanonicalResult({executionId:execution.executionId});
assert.equal(settlement.authorized,false,"#416 must continue to block fresh debit while suspended without confirmed provider effect");
assert.equal(settlement.outcome,"reserved");

const unclaimed=await store.releaseUnclaimedReservation({executionId:execution.executionId});
assert.equal(unclaimed.authorized,false,"unclaimed release must not rewrite finalized canonical authority");
assert.equal(unclaimed.reason,"execution-not-active");

const unbound=await store.releaseUnboundReservation({reservationId:reservation.reservationId,principalId:reservation.principalId,projectId:reservation.projectId});
assert.equal(unbound.authorized,false,"unbound release must not steal a reservation already bound to an execution");
assert.equal(unbound.reason,"reservation-already-bound-to-execution");

const compensation=await store.compensateSupersededCreatorState({execution,recoveryConflict:null,providerEffects:[]}).catch(error=>({authorized:false,reason:error.code}));
assert.equal(compensation.authorized,false,"Creator Compensation must not invent superseded-state authority for this finalized canonical result");

const decisionStore=createMovieMentorTerminalDispositionDecisionMongoStore();
const authorizedDecision={
 decisionId:"terminal-decision-417",principalId:reservation.principalId,reservationId:reservation.reservationId,executionId:execution.executionId,
 decisionSource:"movie-mentor-enforcement",decisionKind:"policy-approved-terminal-reservation-release",decidedBy:"creator-policy-authority",
 policyVersion:"movie-mentor-enforcement-v1",caseReference:"terminal-case-417",entitlementRevision:10,decidedAt:"2032-01-01T00:04:30.000Z"
};
const recorded=await decisionStore.recordAuthorizedDecision({decision:authorizedDecision});
assert.equal(recorded.authorized,true);
const durableDecision=await decisionStore.resolveAuthorizedDecision({decisionId:authorizedDecision.decisionId,principalId:reservation.principalId});
assert.equal(durableDecision?.durableAuthority,true);
assert.equal(durableDecision?.entitlementRevision,10,"durable terminal policy authority must bind the exact entitlement revision it authorized");

await assert.rejects(
 ()=>store.terminallyReleaseAuthorizedReservation({executionId:execution.executionId,decision:{...durableDecision,decisionId:"fabricated-terminal-decision"},expectedEntitlementRevision:10}),
 error=>error?.code==="MOVIE_MENTOR_TERMINAL_RELEASE_DECISION_NOT_DURABLE",
 "caller-supplied terminal decision must not self-authorize value release"
);

const terminalRelease=await store.terminallyReleaseAuthorizedReservation({executionId:execution.executionId,decision:durableDecision,expectedEntitlementRevision:10});
assert.equal(terminalRelease.authorized,true);
assert.equal(terminalRelease.released,true);
assert.equal(terminalRelease.idempotent,false);

const replay=await store.terminallyReleaseAuthorizedReservation({executionId:execution.executionId,decision:durableDecision,expectedEntitlementRevision:10});
assert.equal(replay.authorized,true);
assert.equal(replay.released,true);
assert.equal(replay.idempotent,true,"same durable terminal decision replay must not restore value twice");

const durableReservation=await db.collection("movie_mentor_inference_spend_reservation").findOne({reservationId:reservation.reservationId});
const durableEntitlement=await db.collection("movie_mentor_inference_entitlement").findOne({principalId:reservation.principalId});
const durableExecution=await db.collection("movie_mentor_inference_execution").findOne({executionId:execution.executionId});

assert.equal(durableExecution.phase,"finalized");
assert.equal(durableEntitlement.status,"suspended");
assert.equal(durableEntitlement.status,"suspended","terminal value disposition must not reactivate the entitlement");
assert.equal(durableEntitlement.remainingUnits,7,"two reserved units must be restored exactly once");
assert.equal(durableEntitlement.reservedUnits,0);
assert.equal(durableEntitlement.consumedUnits,3);
assert.equal(durableEntitlement.entitlementRevision,11);
assert.equal(durableReservation.status,"released","durable terminal policy authority must own a terminal disposition for the stranded reservation");
assert.equal(durableReservation.terminalDispositionDecisionId,authorizedDecision.decisionId);
assert.equal(durableExecution.phase,"finalized","terminal value disposition must preserve finalized canonical execution history");

console.log("PR #417 suspended finalized reservation terminal disposition authority: GREEN");
console.log("LAW: SUSPENSION MAY HOLD VALUE WHILE AUTHORITY IS UNRESOLVED. ONLY DURABLE PRINCIPAL-BOUND TERMINAL POLICY AUTHORITY MAY RELEASE A FINALIZED NO-EFFECT RESERVATION; VALUE IS RESTORED EXACTLY ONCE WITHOUT REACTIVATION OR CANONICAL-HISTORY REWRITE.");
await mongoose.disconnect();
