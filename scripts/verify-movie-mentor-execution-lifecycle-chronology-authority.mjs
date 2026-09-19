import assert from "node:assert/strict";
import {inspectMovieMentorInferenceExecution} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

console.log("Movie Mentor execution lifecycle chronology authority court");

const base={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-chrono",creatorTurnId:"turn-chrono",principalId:"creator-chrono",projectId:"project-chrono",reservationId:"reservation-chrono",requestDigest:"request-chrono",phase:"settled",ownerId:"owner-chrono",leaseGeneration:1,leaseReference:"lease-chrono",fencingToken:"fence-chrono",leaseAcquiredAt:"2032-01-01T00:00:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0,settlementRealityBarrierRevision:1,resultFinalizationBarrierRevision:1,closureReference:"closure-chrono",frozenProviderCallCount:0,frozenProviderCallSetDigest:"frozen-chrono",closingAt:"2032-01-01T00:01:00.000Z",closedFromExecutionGeneration:1,closurePolicyVersion:"policy-chrono",closureCertificateDigest:"certificate-chrono",closedAt:"2032-01-01T00:02:00.000Z",finalizedResultReference:"result-chrono",finalizedCandidateReference:"candidate-chrono",finalizedResultDigest:"digest-chrono",resultFinalizedAt:"2032-01-01T00:03:00.000Z",settledResultReference:"result-chrono",settledCandidateReference:"candidate-chrono",settledResultDigest:"digest-chrono",settledAt:"2032-01-01T00:04:00.000Z",abortedAt:null,abortReason:"",quarantinedAt:null,quarantineReason:"",quarantinedFromPhase:""};

assert.equal(inspectMovieMentorInferenceExecution(base).valid,true,"control settled lifecycle must be valid");
for(const [name,record] of [
 ["closed-before-closing",{...base,closedAt:"2032-01-01T00:00:30.000Z"}],
 ["finalized-before-closed",{...base,resultFinalizedAt:"2032-01-01T00:01:30.000Z"}],
 ["settled-before-finalized",{...base,settledAt:"2032-01-01T00:02:30.000Z"}]
]){
 const inspected=inspectMovieMentorInferenceExecution(record);
 assert.equal(inspected.valid,false,`${name}: impossible durable lifecycle chronology must fail closed`);
}
console.log("GREEN: durable execution lifecycle chronology is ordered closing <= closed <= finalized <= settled.");
console.log("LAW: DURABLE PHASE HISTORY MAY ADVANCE. ITS CLOCK MAY NOT RUN BACKWARDS.");
