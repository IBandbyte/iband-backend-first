import fs from "node:fs";

function replaceExact(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`${label} anchor missing`);
  return source.replace(oldText, newText);
}

const settlementPath="ai/MovieMentorInferenceSettlementMongoStore.js";
let settlement=fs.readFileSync(settlementPath,"utf8");
settlement=replaceExact(settlement,'const VERSION="1.8.0"','const VERSION="1.9.0"',"settlement version");
settlement=replaceExact(
  settlement,
  'return Object.freeze({settleCanonicalResult,releaseUnclaimedReservation,releaseUnboundReservation});}',
  'return Object.freeze({settleCanonicalResult,releaseUnclaimedReservation,releaseUnboundReservation,getStatus:getMovieMentorInferenceSettlementMongoStoreStatus});}',
  "store-owned capability status"
);
fs.writeFileSync(settlementPath,settlement);

const compositionPath="ai/MovieMentorProductionInferenceSettlementComposition.js";
let composition=fs.readFileSync(compositionPath,"utf8");
composition=replaceExact(composition,'const VERSION="1.1.0";','const VERSION="1.2.0";',"composition version");
const oldFn='function createMovieMentorProductionInferenceSettlementComposition({store=null}={}){const status=store?{configured:true,readiness:"injected",atomicity:"injected",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true}:getMovieMentorInferenceSettlementMongoStoreStatus();if(status.configured!==true)return Object.freeze({ready:false,reason:"inference-settlement-store-not-configured",version:VERSION,authority:null,storeStatus:status});if(status.settledExecutionAuthority!==true||status.atomicFinalizedToSettledDebit!==true||status.explicitDebitBinding!==true||status.proofTimeFailClosed!==true)return Object.freeze({ready:false,reason:"inference-settlement-settled-capability-not-proven",version:VERSION,authority:null,storeStatus:status,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});try{const durableStore=store||createMovieMentorInferenceSettlementMongoStore(),authority=createMovieMentorInferenceSettlementReconciliationAuthority({store:durableStore});return Object.freeze({ready:true,reason:"atomic-finalized-to-settled-current-reality-debit-authority-composed",version:VERSION,authority,storeStatus:status,settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true});}catch(error){return Object.freeze({ready:false,reason:error?.code||"inference-settlement-composition-failed",version:VERSION,authority:null,storeStatus:status,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});}}';
const newFn='function createMovieMentorProductionInferenceSettlementComposition({store=null}={}){const injected=Boolean(store),status=injected?(typeof store?.getStatus==="function"?store.getStatus():null):getMovieMentorInferenceSettlementMongoStoreStatus();if(injected&&!status)return Object.freeze({ready:false,reason:"inference-settlement-injected-capability-not-proven",version:VERSION,authority:null,storeStatus:null,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});if(status?.configured!==true)return Object.freeze({ready:false,reason:"inference-settlement-store-not-configured",version:VERSION,authority:null,storeStatus:status||null,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});if(status.settledExecutionAuthority!==true||status.atomicFinalizedToSettledDebit!==true||status.explicitDebitBinding!==true||status.proofTimeFailClosed!==true)return Object.freeze({ready:false,reason:"inference-settlement-settled-capability-not-proven",version:VERSION,authority:null,storeStatus:status,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});try{const durableStore=store||createMovieMentorInferenceSettlementMongoStore(),authority=createMovieMentorInferenceSettlementReconciliationAuthority({store:durableStore});return Object.freeze({ready:true,reason:"atomic-finalized-to-settled-current-reality-debit-authority-composed",version:VERSION,authority,storeStatus:status,settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true});}catch(error){return Object.freeze({ready:false,reason:error?.code||"inference-settlement-composition-failed",version:VERSION,authority:null,storeStatus:status,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});}}';
composition=replaceExact(composition,oldFn,newFn,"composition provenance contract");
fs.writeFileSync(compositionPath,composition);

const verifierPath="scripts/verify-movie-mentor-production-settled-capability.mjs";
let verifier=fs.readFileSync(verifierPath,"utf8");
verifier=replaceExact(
  verifier,
  'const injectedStore={\n  settleCanonicalResult:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",explicitDebitBindingVerified:true}),',
  'const unprovenInjectedStore={\n  settleCanonicalResult:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",explicitDebitBindingVerified:true}),\n  releaseUnclaimedReservation:async()=>({authorized:true,released:true,outcome:"released"}),\n  releaseUnboundReservation:async()=>({authorized:true,released:true,outcome:"released"}),\n};\nconst rejectedInjection=createMovieMentorProductionInferenceSettlementComposition({store:unprovenInjectedStore});\nassert.equal(rejectedInjection.ready,false);\nassert.equal(rejectedInjection.reason,"inference-settlement-injected-capability-not-proven");\n\nconst injectedStore={\n  getStatus:()=>({configured:true,readiness:"injected-proven",atomicity:"single-mongo-transaction",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true}),\n  settleCanonicalResult:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",explicitDebitBindingVerified:true}),',
  "verifier injected provenance"
);
verifier=replaceExact(
  verifier,
  'console.log("✓ production composition advertises only explicit SETTLED debit authority");',
  'console.log("✓ production composition advertises only explicit SETTLED debit authority");\nconsole.log("✓ injected stores receive zero capability credit unless the store itself exposes the exact capability status");',
  "verifier provenance output"
);
verifier=replaceExact(
  verifier,
  'LAW: METHOD PRESENCE IS NOT ECONOMIC AUTHORITY. PRODUCTION MAY MOUNT ONLY WHEN THE COMPOSED SETTLEMENT STORE PROVES ATOMIC FINALIZED-TO-SETTLED DEBIT + EXPLICIT DURABLE DEBIT LINEAGE + FAIL-CLOSED PROOF TIME.',
  'LAW: METHOD PRESENCE IS NOT ECONOMIC AUTHORITY. COMPOSITION MAY NOT MANUFACTURE CAPABILITY FOR AN INJECTED STORE. PRODUCTION MAY MOUNT ONLY WHEN THE SETTLEMENT STORE ITSELF PROVES ATOMIC FINALIZED-TO-SETTLED DEBIT + EXPLICIT DURABLE DEBIT LINEAGE + FAIL-CLOSED PROOF TIME.',
  "verifier law"
);
fs.writeFileSync(verifierPath,verifier);

console.log("settlement capability provenance hardening applied");
