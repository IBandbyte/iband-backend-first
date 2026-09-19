import assert from "node:assert/strict";
import {inspectMovieMentorInferenceExecution} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

console.log("Movie Mentor quarantine lifecycle chronology authority court");

const base={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-quarantine-chrono",creatorTurnId:"turn-quarantine-chrono",principalId:"creator-quarantine-chrono",projectId:"project-quarantine-chrono",reservationId:"reservation-quarantine-chrono",requestDigest:"request-quarantine-chrono",phase:"quarantined",ownerId:"owner-quarantine-chrono",leaseGeneration:1,leaseReference:"lease-quarantine-chrono",fencingToken:"fence-quarantine-chrono",leaseAcquiredAt:"2032-01-01T00:00:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,resultFinalizationBarrierRevision:0,closureReference:"closure-quarantine-chrono",frozenProviderCallCount:0,frozenProviderCallSetDigest:"digest-empty",closingAt:"2032-01-01T00:05:00.000Z",closedFromExecutionGeneration:1,closurePolicyVersion:"court",closureCertificateDigest:"",closedAt:null,finalizedResultReference:"",finalizedCandidateReference:"",finalizedResultDigest:"",resultFinalizedAt:null,settledResultReference:"",settledCandidateReference:"",settledResultDigest:"",settledAt:null,abortedAt:null,abortReason:"",quarantinedAt:"2032-01-01T00:04:59.000Z",quarantineReason:"court-conflict",quarantinedFromPhase:"closing"};

assert.equal(inspectMovieMentorInferenceExecution(base).valid,false,"quarantine cannot predate the authoritative closing history it preserves");
const control=structuredClone(base);control.quarantinedAt="2032-01-01T00:05:01.000Z";
assert.equal(inspectMovieMentorInferenceExecution(control).valid,true,"quarantine after its preserved closing history remains valid");
console.log("GREEN: quarantine chronology is bound to preserved lifecycle history.");
console.log("LAW: QUARANTINE MAY REVOKE CURRENT AUTHORITY. IT MAY NOT PRETEND TO PRECEDE THE HISTORY IT PRESERVES.");
