import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorProductionInferenceSettlementComposition } from "../ai/MovieMentorProductionInferenceSettlementComposition.js";

const settlementStore = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");
const compositionSource = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSettlementComposition.js", import.meta.url), "utf8");
const serverSource = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");

for (const capability of ["settledExecutionAuthority","atomicFinalizedToSettledDebit","explicitDebitBinding","proofTimeFailClosed"]) {
  assert.match(settlementStore, new RegExp(`${capability}:true`), `settlement store status must expose ${capability}`);
  assert.match(compositionSource, new RegExp(`${capability}:true`), `production settlement composition must surface ${capability}`);
  assert.match(serverSource, new RegExp(`settlementComposition\\?\\.${capability}!==true`), `server must fail closed without ${capability}`);
}
assert.match(compositionSource,/inference-settlement-settled-capability-not-proven/);
assert.match(compositionSource,/atomic-finalized-to-settled-current-reality-debit-authority-composed/);
assert.match(serverSource,/canonical FINALIZED result \+ atomic FINALIZED-to-SETTLED creator debit/);
assert.match(serverSource,/finalized-result-atomic-settled-debit-gateway-mounted/);
assert.match(serverSource,/creator debit requires exact FINALIZED proof -> atomic SETTLED execution \+ explicit durable debit lineage/);

const unprovenInjectedStore={
  settleCanonicalResult:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",explicitDebitBindingVerified:true}),
  releaseUnclaimedReservation:async()=>({authorized:true,released:true,outcome:"released"}),
  releaseUnboundReservation:async()=>({authorized:true,released:true,outcome:"released"}),
};
const rejectedInjection=createMovieMentorProductionInferenceSettlementComposition({store:unprovenInjectedStore});
assert.equal(rejectedInjection.ready,false);
assert.equal(rejectedInjection.reason,"inference-settlement-injected-capability-not-proven");

const injectedStore={
  getStatus:()=>({configured:true,readiness:"injected-proven",atomicity:"single-mongo-transaction",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true}),
  settleCanonicalResult:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",explicitDebitBindingVerified:true}),
  releaseUnclaimedReservation:async()=>({authorized:true,released:true,outcome:"released"}),
  releaseUnboundReservation:async()=>({authorized:true,released:true,outcome:"released"}),
};
const composition=createMovieMentorProductionInferenceSettlementComposition({store:injectedStore});
assert.equal(composition.ready,true);
assert.equal(composition.settledExecutionAuthority,true);
assert.equal(composition.atomicFinalizedToSettledDebit,true);
assert.equal(composition.explicitDebitBinding,true);
assert.equal(composition.proofTimeFailClosed,true);
assert.equal(typeof composition.authority.reconcile,"function");
assert.equal(typeof composition.authority.releaseUnclaimed,"function");
assert.equal(typeof composition.authority.releaseUnbound,"function");

console.log("5A.24 production SETTLED capability gate: GREEN");
console.log("✓ production composition advertises only explicit SETTLED debit authority");
console.log("✓ injected stores receive zero capability credit unless the store itself exposes the exact capability status");
console.log("✓ server mount refuses settlement composition without exact SETTLED capability proof");
console.log("✓ mounted gateway language names FINALIZED -> SETTLED creator debit ownership");
console.log("LAW: METHOD PRESENCE IS NOT ECONOMIC AUTHORITY. COMPOSITION MAY NOT MANUFACTURE CAPABILITY FOR AN INJECTED STORE. PRODUCTION MAY MOUNT ONLY WHEN THE SETTLEMENT STORE ITSELF PROVES ATOMIC FINALIZED-TO-SETTLED DEBIT + EXPLICIT DURABLE DEBIT LINEAGE + FAIL-CLOSED PROOF TIME.");
