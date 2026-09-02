import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorProductionInferenceSpendComposition,isMovieMentorProductionInferenceSpendOwnerProof} from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import {createMovieMentorProductionInferenceExecutionComposition,isMovieMentorProductionInferenceExecutionOwnerProof} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import {createMovieMentorProductionInferenceSettlementComposition,isMovieMentorProductionInferenceSettlementOwnerProof} from "../ai/MovieMentorProductionInferenceSettlementComposition.js";

function torture(label,composition,predicate){
  assert.equal(composition.ready,true,`${label} genuine composition must be ready`);
  const status=composition.getStatus();
  assert.equal(predicate(composition,status),true,`${label} exact owner pair must be registered`);
  const reconstructed=Object.freeze({...status});
  assert.deepEqual(reconstructed,status);
  assert.notEqual(reconstructed,status);
  assert.equal(predicate(composition,reconstructed),false,`${label} reconstructed status must receive zero owner credit`);
  const forged=Object.freeze({...composition,status,getStatus:()=>status});
  assert.equal(forged.status,status);
  assert.equal(forged.getStatus(),status);
  assert.equal(forged.authority,composition.authority);
  assert.equal(predicate(forged,status),false,`${label} self-consistent forged composition must receive zero owner credit`);
}

const spendStoreStatus=Object.freeze({configured:true,readiness:"injected-proven",atomicity:"mongo-transaction",settlement:"external-durable-current-reality-authority-only",durableReservationRead:true,genericSettlementCapability:false,processLocalFallback:false});
const spendStore={getStatus:()=>spendStoreStatus,reserve:async()=>({granted:false,reason:"torture"}),readReservation:async()=>null};
torture("spend",createMovieMentorProductionInferenceSpendComposition({store:spendStore}),isMovieMentorProductionInferenceSpendOwnerProof);

const executionStoreStatus=Object.freeze({configured:true,readiness:"injected-proven",durable:true,cas:"reservation-binding-active-closure-frozen-universe-provider-reality-revision-finalized-result-binding-and-atomic-abort"});
const executionStore={getStatus:()=>executionStoreStatus,readExecution:async()=>null,readExecutionByCreatorTurn:async()=>null,createExecution:async()=>null,replaceExecution:async()=>null,claimProviderCall:async()=>({claimed:false}),beginClosing:async()=>null,recoverExpiredIntoClosing:async()=>null,completeClosing:async()=>null,quarantineExecution:async()=>null};
torture("execution",createMovieMentorProductionInferenceExecutionComposition({store:executionStore}),isMovieMentorProductionInferenceExecutionOwnerProof);

const settlementStoreStatus=Object.freeze({configured:true,readiness:"injected-proven",atomicity:"single-mongo-transaction",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true});
const settlementStore={getStatus:()=>settlementStoreStatus,settleCanonicalResult:async()=>({}),releaseUnclaimedReservation:async()=>({}),releaseUnboundReservation:async()=>({})};
torture("settlement",createMovieMentorProductionInferenceSettlementComposition({store:settlementStore}),isMovieMentorProductionInferenceSettlementOwnerProof);

const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
for(const [predicate,gate] of [
  ["isMovieMentorProductionInferenceSpendOwnerProof","spendCompositionProven"],
  ["isMovieMentorProductionInferenceExecutionOwnerProof","executionCompositionProven"],
  ["isMovieMentorProductionInferenceSettlementOwnerProof","settlementCompositionProven"],
]){
  assert.match(serverSource,new RegExp(`${predicate}\\(composition,status\\)`));
  const predicateIndex=serverSource.indexOf(`${predicate}(composition,status)`);
  const routeIndex=serverSource.indexOf('app.use("/api/movie-mentor", router)');
  assert.ok(predicateIndex>=0&&routeIndex>predicateIndex,`${gate} private owner predicate must precede creator route registration`);
}
assert.ok(serverSource.indexOf("!spendCompositionProven(spendComposition,spendStatus)")<serverSource.indexOf("createMovieMentorTurnRouter({requestAuthority"));
assert.ok(serverSource.indexOf("!executionCompositionProven(executionComposition,executionStatus)")<serverSource.indexOf("createMovieMentorTurnRouter({requestAuthority"));
assert.ok(serverSource.indexOf("!settlementCompositionProven(settlementComposition,settlementStatus)")<serverSource.indexOf("createMovieMentorTurnRouter({requestAuthority"));

console.log("✓ spend owner registry rejects reconstructed and self-consistent forged compositions");
console.log("✓ execution owner registry rejects reconstructed and self-consistent forged compositions");
console.log("✓ settlement owner registry rejects reconstructed and self-consistent forged compositions");
console.log("✓ creator HTTP boundary consumes all three private owner predicates before route registration");
console.log("LAW: SPEND / EXECUTION / SETTLEMENT OWNER REGISTRY → EXACT OWNER PREDICATE → CREATOR HTTP BOUNDARY → ROUTE");
console.log('🐔 Zorg: "Three folders. Every reference matches." ⚔️ Kraken: "THREE OWNER REGISTRIES?" 🐔 Zorg: "...no."');
console.log("Gates of Authority — Three-Headed Kraken: GREEN");
