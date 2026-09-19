import assert from "node:assert/strict";
import {inspectMovieMentorInferenceExecution} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

console.log("Movie Mentor provider admission owning-lease chronology authority court");

const base={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-provider-lease-chrono",creatorTurnId:"turn-provider-lease-chrono",principalId:"creator-provider-lease-chrono",projectId:"project-provider-lease-chrono",reservationId:"reservation-provider-lease-chrono",requestDigest:"request-provider-lease-chrono",phase:"active",ownerId:"owner-provider-lease-chrono",leaseGeneration:3,leaseReference:"lease-provider-lease-chrono",fencingToken:"fence-provider-lease-chrono",leaseAcquiredAt:"2032-01-01T00:05:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:2,providerCallsClaimed:1,providerCalls:[{providerCallId:"call-A",slotId:"slot-A",task:"story",state:"admitted",leaseGeneration:3,leaseReference:"lease-provider-lease-chrono",fencingToken:"fence-provider-lease-chrono",admittedAt:"2032-01-01T00:04:59.000Z"}],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,closureReference:"",frozenProviderCallCount:null,frozenProviderCallSetDigest:"",closingAt:null,closedFromExecutionGeneration:null,closurePolicyVersion:"",closureCertificateDigest:"",closedAt:null,finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:""};

assert.equal(inspectMovieMentorInferenceExecution(base).valid,false,"provider call admitted before its claimed owning lease was acquired must fail closed");
const control=structuredClone(base);control.providerCalls[0].admittedAt="2032-01-01T00:05:01.000Z";
assert.equal(inspectMovieMentorInferenceExecution(control).valid,true,"provider call admitted inside its owning lease lifetime remains valid");
console.log("GREEN: provider admission cannot predate its claimed owning lease.");
console.log("LAW: A PROVIDER CALL MAY NOT CLAIM TEMPORAL AUTHORITY FROM A LEASE THAT DID NOT YET EXIST.");
