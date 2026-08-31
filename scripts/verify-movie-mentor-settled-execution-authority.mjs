import assert from "node:assert/strict";
import fs from "node:fs";
import { replayTerminalTurn } from "../ai/MovieMentorTurnRuntime.js";
import { inspectMovieMentorInferenceExecution } from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const settlementStore = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");
const spendStore = fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js", import.meta.url), "utf8");
const executionStore = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js", import.meta.url), "utf8");
const providerEffectStore = fs.readFileSync(new URL("../ai/MovieMentorProviderEffectMongoStore.js", import.meta.url), "utf8");
const closureAuthority = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js", import.meta.url), "utf8");
const canonicalAuthority = fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultAuthority.js", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const gateway = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");

for (const field of ["settledResultReference", "settledCandidateReference", "settledResultDigest", "settledAt"]) assert.match(executionStore, new RegExp(field));
for (const field of ["settlementExecutionId", "settlementResultReference", "settlementCandidateReference", "settlementResultDigest"]) {
  assert.match(settlementStore, new RegExp(field));
  assert.match(spendStore, new RegExp(field));
}
assert.match(settlementStore, /session\.withTransaction/);
assert.match(settlementStore, /phase:"settled"/);
assert.match(settlementStore, /explicitSettlementBinding/);
assert.match(settlementStore, /reservationSettlementBindingValid/);
assert.match(settlementStore, /legacySettlementMigrated:true/);
assert.match(settlementStore, /historicalSettledAt=new Date\(reservation\.settledAt\)/);
assert.match(settlementStore, /settlementReason:`canonical-result:\$\{text\(result\.resultReference\)\}`/);
assert.match(settlementStore, /MOVIE_MENTOR_INFERENCE_SETTLEMENT_SETTLED_CONFLICT/);
assert.match(settlementStore, /MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHASE_LEDGER_CONFLICT/);
assert.match(closureAuthority, /\["closed","finalized","settled"\]/);
assert.match(canonicalAuthority, /\['finalized','settled'\]/);
assert.match(runtime, /\["closed", "finalized", "settled"\]/);
assert.match(runtime, /executionPhase !== "settled"/);
assert.match(gateway, /settledExecutionAuthorityRequired:true/);
assert.match(gateway, /settlementTransitionsFinalizedToSettledAtomically:true/);

// Late provider reality must remain observable after SETTLED without recreating forward execution authority.
assert.match(executionStore, /\["closing","closed","finalized","settled"\]\.includes\(current\.phase\)/,
  "closure quarantine must accept SETTLED so late provider conflict can be made durable");
assert.match(executionStore, /quarantinedFromPhase:current\.phase/,
  "quarantine must durably preserve the exact proof-bearing phase it revoked");
assert.match(executionStore, /proofPhase=phase==="quarantined"\?quarantinedFromPhase:phase/,
  "quarantined records must continue validating the proof contract of their prior phase");
assert.match(executionStore, /MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINE_PROVENANCE_INVALID/);
assert.match(executionStore, /executionId:text\(input\.executionId\),phase:"active",ownerId:/,
  "new provider-call admission must remain ACTIVE-only");
assert.match(providerEffectStore, /executionLedger\(\)\.updateOne\(\{executionId:current\.executionId\},\{\$inc:\{providerEffectRealityRevision:1\}\}/,
  "late evidence must increment shared execution provider-reality revision without requiring ACTIVE phase");
assert.doesNotMatch(providerEffectStore, /appendEvidence[\s\S]*?executionLedger\(\)\.updateOne\(\{executionId:current\.executionId,phase:"active"/,
  "late evidence observation must not be discarded merely because execution is SETTLED");

const quarantineRecord = {
  domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:"execution-q",creatorTurnId:"turn-q",principalId:"creator-q",projectId:"project-q",reservationId:"reservation-q",requestDigest:"request-q",phase:"quarantined",ownerId:"owner-q",leaseGeneration:1,leaseReference:"lease-q",fencingToken:"fence-q",leaseAcquiredAt:"2032-01-01T00:00:00.000Z",leaseExpiresAt:"2032-01-01T00:10:00.000Z",maxProviderCalls:1,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:4,settlementRealityBarrierRevision:1,resultFinalizationBarrierRevision:1,closureReference:"closure-q",frozenProviderCallCount:0,frozenProviderCallSetDigest:"frozen-q",closingAt:"2032-01-01T00:01:00.000Z",closedFromExecutionGeneration:1,closurePolicyVersion:"policy-q",closureCertificateDigest:"certificate-q",closedAt:"2032-01-01T00:02:00.000Z",finalizedResultReference:"result-q",finalizedCandidateReference:"candidate-q",finalizedResultDigest:"digest-q",resultFinalizedAt:"2032-01-01T00:03:00.000Z",settledResultReference:"result-q",settledCandidateReference:"candidate-q",settledResultDigest:"digest-q",settledAt:"2032-01-01T00:04:00.000Z",abortedAt:null,abortReason:"",quarantinedAt:"2032-01-01T00:05:00.000Z",quarantineReason:"late-provider-conflict",quarantinedFromPhase:"settled"
};
assert.equal(inspectMovieMentorInferenceExecution(quarantineRecord).valid,true,
  "a current-schema quarantine from SETTLED must preserve and validate exact settled lineage");
assert.equal(inspectMovieMentorInferenceExecution({...quarantineRecord,quarantinedFromPhase:""}).valid,false,
  "current-schema quarantine may not erase its source phase");
assert.equal(inspectMovieMentorInferenceExecution({...quarantineRecord,settledResultDigest:"wrong"}).valid,false,
  "quarantine from SETTLED may not weaken exact finalized/settled lineage validation");
assert.equal(inspectMovieMentorInferenceExecution({...quarantineRecord,schema:5,quarantinedFromPhase:undefined}).valid,true,
  "legacy quarantine remains readable through deterministic evidence-based provenance inference without gaining new authority");

const consumedBranch = settlementStore.indexOf('if(text(reservation.status)==="consumed")');
const freshBarrier = settlementStore.indexOf('const settledAt=new Date(now());const barrier=');
const entitlementDebit = settlementStore.indexOf('const entitlement=await entitlements.findOneAndUpdate', freshBarrier);
const reservationConsume = settlementStore.indexOf('const settled=await reservations.findOneAndUpdate', entitlementDebit);
assert.ok(consumedBranch > 0 && freshBarrier > consumedBranch && entitlementDebit > freshBarrier && reservationConsume > entitlementDebit,
  "legacy consumed migration must return before the fresh entitlement debit path; fresh FINALIZED→SETTLED barrier must precede ledger debit and reservation consume inside one transaction");
const legacyWindow = settlementStore.slice(consumedBranch, freshBarrier);
assert.doesNotMatch(legacyWindow, /entitlements\.findOneAndUpdate/, "legacy consumed migration must never debit entitlement again");
assert.match(legacyWindow, /reservations\.updateOne/, "legacy migration must backfill explicit durable debit lineage");
assert.match(legacyWindow, /executions\.updateOne/, "legacy migration must bind FINALIZED→SETTLED atomically");

const canonical = {authorized:true,committed:true,resultReference:"result-1",resultDigest:"digest-1",executionId:"execution-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",reservationId:"reservation-1",resultPayload:{success:true,text:"durable-settled-replay"}};
const existing = {found:true,phase:"settled",executionId:"execution-1"};
let providerReads = 0;
const replay = await replayTerminalTurn({
  existing,
  inferenceExecutionAuthority:{readCanonicalResult:async()=>canonical,claimProviderCall:async()=>{providerReads++;throw new Error("SETTLED replay must never acquire provider authority");}},
  settlementAuthority:{reconcile:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",idempotent:true})},
});
assert.equal(replay.text,"durable-settled-replay");
assert.equal(replay.metadata.canonicalResult.replayedFromDurableResult,true);
assert.equal(replay.metadata.canonicalResult.settlementExecutionPhase,"settled");
assert.equal(providerReads,0);
await assert.rejects(()=>replayTerminalTurn({
  existing,
  inferenceExecutionAuthority:{readCanonicalResult:async()=>canonical},
  settlementAuthority:{reconcile:async()=>({authorized:true,settled:true,outcome:"consumed"})},
}), e=>e.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_RECONCILIATION_PENDING");

console.log("5A.24 SETTLED execution ownership catastrophe gate: GREEN");
console.log("✓ FINALIZED owns canonical lineage only; creator debit authority is not credited until SETTLED");
console.log("✓ fresh consume writes SETTLED barrier -> entitlement debit -> consumed reservation inside one Mongo transaction");
console.log("✓ explicit reservation debit lineage binds execution + result + candidate + digest");
console.log("✓ exact legacy FINALIZED+CONSUMED history migrates to SETTLED without a second entitlement debit");
console.log("✓ SETTLED replay requires executionPhase=settled and cannot reacquire provider authority");
console.log("✓ late provider evidence remains observable after SETTLED, increments shared reality revision, and can quarantine current closure without recreating execution authority");
console.log("✓ QUARANTINED preserves the exact phase it revoked and continues validating that phase's immutable proof lineage");
console.log("LAW: NO PHASE GETS CREDIT FOR A PROOF IT DOESN'T OWN. QUARANTINE MAY REVOKE CURRENT TRUST, BUT IT MAY NOT ERASE WHICH PROOF-BEARING PHASE WAS REVOKED OR WEAKEN THAT PHASE'S HISTORICAL LINEAGE.");
