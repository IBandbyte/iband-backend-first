import assert from "node:assert/strict";
import {inspectMovieMentorInferenceExecution} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

console.log("Movie Mentor provider admission closure chronology authority court");

const record={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-provider-chrono",creatorTurnId:"turn-provider-chrono",principalId:"creator-provider-chrono",projectId:"project-provider-chrono",reservationId:"reservation-provider-chrono",requestDigest:"request-provider-chrono",phase:"closing",ownerId:"owner-provider-chrono",leaseGeneration:1,leaseReference:"lease-provider-chrono",fencingToken:"fence-provider-chrono",leaseAcquiredAt:"2032-01-01T00:00:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:2,providerCallsClaimed:1,providerCalls:[{providerCallId:"call-A",slotId:"slot-A",task:"story",state:"admitted",leaseGeneration:1,leaseReference:"lease-provider-chrono",fencingToken:"fence-provider-chrono",admittedAt:"2032-01-01T00:06:00.000Z"}],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,closureReference:"closure-provider-chrono",frozenProviderCallCount:1,frozenProviderCallSetDigest:"frozen-provider-chrono",closingAt:"2032-01-01T00:05:00.000Z",closedFromExecutionGeneration:1,closurePolicyVersion:"policy-provider-chrono",closureCertificateDigest:"",closedAt:null,finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:""};

const impossible=inspectMovieMentorInferenceExecution(record);
assert.equal(impossible.valid,false,"provider call admitted after durable closingAt must not belong to frozen closure universe");

const control=structuredClone(record); control.providerCalls[0].admittedAt="2032-01-01T00:04:59.000Z";
assert.equal(inspectMovieMentorInferenceExecution(control).valid,true,"provider call admitted before closingAt remains valid");

console.log("GREEN: frozen closure universe rejects provider admission from its own future.");
console.log("LAW: A CLOSURE MAY FREEZE PRIOR ADMISSIONS. IT MAY NOT FREEZE A CALL ADMITTED AFTER CLOSURE BEGAN.");
