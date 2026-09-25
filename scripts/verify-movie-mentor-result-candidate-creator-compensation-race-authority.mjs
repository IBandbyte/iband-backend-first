import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.36 — result-candidate ↔ Creator Compensation race authority");

const candidateSource=fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js",import.meta.url),"utf8");
const settlementSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");

// Production reachability: both dispositions mutate the exact shared execution
// document inside their transactions. Candidate additionally touches the exact
// current Creator-state document before minting immutable result lineage.
assert.match(candidateSource,/creatorStateLedger\(\)\.updateOne\([\s\S]*?resultCandidateBarrierRevision:1/);
assert.match(candidateSource,/executionLedger\(\)\.updateOne\([\s\S]*?phase:"active"[\s\S]*?resultCandidateBarrierRevision:1/);
assert.match(candidateSource,/storeModel\(\)\.create\(\[record\],\{session\}\)/);
assert.match(settlementSource,/const canonical=await results\.findOne\(\{executionId:id\},\{session\}\),candidate=await candidates\.findOne/);
assert.match(settlementSource,/if\(canonical\|\|candidate\).*creator-result-lineage-exists/);
assert.match(settlementSource,/const creatorStateBarrier=await creatorStates\.updateOne\([\s\S]*?compensationBarrierRevision:1/);
assert.match(settlementSource,/const terminal=await executions\.updateOne\(\{executionId:id,phase:text\(execution\.phase\)[\s\S]*?resultCandidateBarrierRevision:candidateBarrierRevision/);
assert.match(settlementSource,/phase:"compensated"/);

function fixture(){
  return {
    creator:{revision:8,generation:8,fingerprint:"b".repeat(64),resultCandidateBarrierRevision:0,compensationBarrierRevision:0},
    execution:{phase:"active",resultCandidateBarrierRevision:0,providerEffectRealityRevision:1},
    candidate:null,
    entitlement:{remainingUnits:4,reservedUnits:1},
    reservation:{status:"reserved"},
  };
}

function candidateCommit(state){
  if(state.candidate)return {ok:false,reason:"candidate-exists"};
  if(state.execution.phase!=="active")return {ok:false,reason:"execution-fenced"};
  state.creator.resultCandidateBarrierRevision+=1;
  state.execution.resultCandidateBarrierRevision+=1;
  state.candidate={executionId:"execution-race",creatorStateRevision:8};
  return {ok:true};
}

function compensationCommit(state,observedCandidateBarrier=state.execution.resultCandidateBarrierRevision){
  if(state.candidate)return {ok:false,reason:"creator-result-lineage-exists"};
  if(state.execution.phase!=="active")return {ok:false,reason:"execution-not-active"};
  if(state.execution.resultCandidateBarrierRevision!==observedCandidateBarrier)return {ok:false,reason:"execution-race"};
  state.creator.compensationBarrierRevision+=1;
  state.execution.phase="compensated";
  state.entitlement.remainingUnits+=1;
  state.entitlement.reservedUnits-=1;
  state.reservation.status="released";
  return {ok:true};
}

// Candidate wins first: compensation must not restore Creator value after
// immutable result lineage exists.
{
  const state=fixture();
  const observedBarrier=state.execution.resultCandidateBarrierRevision;
  assert.equal(candidateCommit(state).ok,true);
  const compensation=compensationCommit(state,observedBarrier);
  assert.equal(compensation.ok,false);
  assert.ok(["creator-result-lineage-exists","execution-race"].includes(compensation.reason));
  assert.equal(state.candidate.executionId,"execution-race");
  assert.equal(state.entitlement.remainingUnits,4);
  assert.equal(state.reservation.status,"reserved");
  console.log("✓ candidate-first leaves result lineage and zero compensation ledger mutation");
}

// Compensation wins first: later candidate staging must not mint result lineage
// from a terminal compensated execution.
{
  const state=fixture();
  assert.equal(compensationCommit(state).ok,true);
  const candidate=candidateCommit(state);
  assert.equal(candidate.ok,false);
  assert.equal(candidate.reason,"execution-fenced");
  assert.equal(state.candidate,null);
  assert.equal(state.execution.phase,"compensated");
  assert.equal(state.entitlement.remainingUnits,5);
  assert.equal(state.reservation.status,"released");
  console.log("✓ compensation-first terminal phase fences later candidate mint");
}

// Snapshot race: if compensation observed candidate absence/barrier 0 and the
// candidate transaction advances the shared execution barrier before terminal
// compensation, the stale terminal CAS cannot match.
{
  const state=fixture();
  const observedBarrier=state.execution.resultCandidateBarrierRevision;
  assert.equal(observedBarrier,0);
  assert.equal(candidateCommit(state).ok,true);
  // Model the terminal CAS independently of the earlier candidate-existence
  // read: the shared execution barrier has moved 0 -> 1.
  assert.notEqual(state.execution.resultCandidateBarrierRevision,observedBarrier);
  console.log("✓ stale compensation snapshot loses the shared execution barrier after candidate commit");
}

console.log("GREEN: candidate lineage and Creator Compensation have one durable winner.");
console.log("LAW: RESULT LINEAGE AND CREATOR COMPENSATION MAY NOT BOTH BECOME DURABLE FOR THE SAME EXECUTION.");
