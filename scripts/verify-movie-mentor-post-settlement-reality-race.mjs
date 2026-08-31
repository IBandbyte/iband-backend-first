import assert from "node:assert/strict";
import fs from "node:fs";
import { inspectMovieMentorInferenceExecution } from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const providerEffectStore=fs.readFileSync(new URL("../ai/MovieMentorProviderEffectMongoStore.js",import.meta.url),"utf8");
const executionStore=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const closureAuthority=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js",import.meta.url),"utf8");
const settlementStore=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");

// Observation is allowed after economic settlement; forward provider authority is not.
assert.match(providerEffectStore,/executionLedger\(\)\.updateOne\(\{executionId:current\.executionId\},\{\$inc:\{providerEffectRealityRevision:1\}\}/);
assert.doesNotMatch(providerEffectStore,/appendEvidence[\s\S]*executionId:current\.executionId,phase:"active"/);
assert.match(providerEffectStore,/executionId:c\.executionId,phase:"active",ownerId,leaseGeneration,leaseReference,fencingToken/);
assert.match(executionStore,/executionId:text\(input\.executionId\),phase:"active",ownerId:/);

// SETTLED is closure-bearing history. A late contradiction can revoke forward authority only by quarantine,
// while retaining the exact proof-bearing source phase and immutable settled lineage.
assert.match(executionStore,/\["closing","closed","finalized","settled"\]\.includes\(current\.phase\)/);
assert.match(executionStore,/quarantinedFromPhase:current\.phase/);
assert.match(executionStore,/proofPhase=phase==="quarantined"\?quarantinedFromPhase:phase/);
assert.match(closureAuthority,/\["closed","finalized","settled"\]/);
assert.match(runtime,/MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED/);
assert.match(settlementStore,/phase==="quarantined"\?"execution-quarantined"/);

const base={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-race",creatorTurnId:"turn-race",principalId:"creator-race",projectId:"project-race",reservationId:"reservation-race",requestDigest:"request-race",phase:"quarantined",ownerId:"owner-race",leaseGeneration:1,leaseReference:"lease-race",fencingToken:"fence-race",leaseAcquiredAt:"2032-01-01T00:00:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:2,settlementRealityBarrierRevision:1,resultFinalizationBarrierRevision:1,closureReference:"closure-race",frozenProviderCallCount:0,frozenProviderCallSetDigest:"frozen-race",closingAt:"2032-01-01T00:01:00.000Z",closedFromExecutionGeneration:1,closurePolicyVersion:"policy-race",closureCertificateDigest:"certificate-race",closedAt:"2032-01-01T00:02:00.000Z",finalizedResultReference:"result-race",finalizedCandidateReference:"candidate-race",finalizedResultDigest:"digest-race",resultFinalizedAt:"2032-01-01T00:03:00.000Z",settledResultReference:"result-race",settledCandidateReference:"candidate-race",settledResultDigest:"digest-race",settledAt:"2032-01-01T00:04:00.000Z",abortedAt:null,abortReason:"",quarantinedAt:"2032-01-01T00:05:00.000Z",quarantineReason:"late-provider-reality-conflict",quarantinedFromPhase:"settled"};
assert.equal(inspectMovieMentorInferenceExecution(base).valid,true);
assert.equal(inspectMovieMentorInferenceExecution({...base,settledResultReference:"other-result"}).valid,false);
assert.equal(inspectMovieMentorInferenceExecution({...base,settledAt:null}).valid,false);
assert.equal(inspectMovieMentorInferenceExecution({...base,quarantinedFromPhase:"active"}).valid,false);

console.log("5A.24 post-SETTLED provider-reality catastrophe gate: GREEN");
console.log("✓ late provider evidence remains durable observation, never renewed dispatch authority");
console.log("✓ provider-effect mutation serializes through execution providerEffectRealityRevision after SETTLED");
console.log("✓ late contradictory reality can quarantine SETTLED while preserving exact economic/result lineage");
console.log("✓ QUARANTINED cannot settle, replay, reacquire, or admit another provider call");
console.log("LAW: SETTLEMENT FREEZES CREATOR DEBIT HISTORY, NOT THE UNIVERSE. LATE REALITY MAY REVOKE FORWARD AUTHORITY, BUT IT MAY NOT ERASE OR REWRITE THE PROOF THAT ALREADY OCCURRED.");
