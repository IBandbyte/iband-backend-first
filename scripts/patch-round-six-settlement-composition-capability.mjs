import fs from "node:fs";

function replaceExact(source, oldText, newText, label) {
  if (!source.includes(oldText)) throw new Error(`${label} anchor missing`);
  return source.replace(oldText, newText);
}

const settlementPath = "ai/MovieMentorInferenceSettlementMongoStore.js";
let settlement = fs.readFileSync(settlementPath, "utf8");
settlement = replaceExact(settlement, 'const VERSION="1.7.0"', 'const VERSION="1.8.0"', "settlement version");
settlement = replaceExact(
  settlement,
  'executionBindingFence:"shared-reservation-write-conflict",processLocalFallback:false',
  'executionBindingFence:"shared-reservation-write-conflict",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true,processLocalFallback:false',
  "settlement status capability"
);
fs.writeFileSync(settlementPath, settlement);

const compositionPath = "ai/MovieMentorProductionInferenceSettlementComposition.js";
let composition = fs.readFileSync(compositionPath, "utf8");
composition = replaceExact(composition, 'const VERSION="1.0.0";', 'const VERSION="1.1.0";', "composition version");
composition = replaceExact(
  composition,
  'function createMovieMentorProductionInferenceSettlementComposition({store=null}={}){const status=store?{configured:true,readiness:"injected",atomicity:"injected"}:getMovieMentorInferenceSettlementMongoStoreStatus();if(status.configured!==true)return Object.freeze({ready:false,reason:"inference-settlement-store-not-configured",version:VERSION,authority:null,storeStatus:status});try{const durableStore=store||createMovieMentorInferenceSettlementMongoStore(),authority=createMovieMentorInferenceSettlementReconciliationAuthority({store:durableStore});return Object.freeze({ready:true,reason:"atomic-current-reality-settlement-authority-composed",version:VERSION,authority,storeStatus:status});}catch(error){return Object.freeze({ready:false,reason:error?.code||"inference-settlement-composition-failed",version:VERSION,authority:null,storeStatus:status});}}',
  'function createMovieMentorProductionInferenceSettlementComposition({store=null}={}){const status=store?{configured:true,readiness:"injected",atomicity:"injected",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true}:getMovieMentorInferenceSettlementMongoStoreStatus();if(status.configured!==true)return Object.freeze({ready:false,reason:"inference-settlement-store-not-configured",version:VERSION,authority:null,storeStatus:status});if(status.settledExecutionAuthority!==true||status.atomicFinalizedToSettledDebit!==true||status.explicitDebitBinding!==true||status.proofTimeFailClosed!==true)return Object.freeze({ready:false,reason:"inference-settlement-settled-capability-not-proven",version:VERSION,authority:null,storeStatus:status,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});try{const durableStore=store||createMovieMentorInferenceSettlementMongoStore(),authority=createMovieMentorInferenceSettlementReconciliationAuthority({store:durableStore});return Object.freeze({ready:true,reason:"atomic-finalized-to-settled-current-reality-debit-authority-composed",version:VERSION,authority,storeStatus:status,settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true});}catch(error){return Object.freeze({ready:false,reason:error?.code||"inference-settlement-composition-failed",version:VERSION,authority:null,storeStatus:status,settledExecutionAuthority:false,atomicFinalizedToSettledDebit:false,explicitDebitBinding:false,proofTimeFailClosed:false});}}',
  "composition capability"
);
fs.writeFileSync(compositionPath, composition);

const serverPath = "server.js";
let server = fs.readFileSync(serverPath, "utf8");
server = replaceExact(
  server,
  'if(settlementComposition?.ready!==true||typeof settlementComposition?.authority?.reconcile!=="function"||typeof settlementComposition?.authority?.releaseUnclaimed!=="function"||typeof settlementComposition?.authority?.releaseUnbound!=="function")',
  'if(settlementComposition?.ready!==true||settlementComposition?.settledExecutionAuthority!==true||settlementComposition?.atomicFinalizedToSettledDebit!==true||settlementComposition?.explicitDebitBinding!==true||settlementComposition?.proofTimeFailClosed!==true||typeof settlementComposition?.authority?.reconcile!=="function"||typeof settlementComposition?.authority?.releaseUnclaimed!=="function"||typeof settlementComposition?.authority?.releaseUnbound!=="function")',
  "server settlement capability gate"
);
server = replaceExact(
  server,
  '[mount:ok] /api/movie-mentor <- authenticated creator gateway + durable reserve/read + full lease/provider-effect dispatch fence + current provider reality + canonical result + atomic consume/unclaimed-release/unbound-release settlement',
  '[mount:ok] /api/movie-mentor <- authenticated creator gateway + durable reserve/read + full lease/provider-effect dispatch fence + current provider reality + canonical FINALIZED result + atomic FINALIZED-to-SETTLED creator debit + unclaimed/unbound release settlement',
  "server mount log"
);
server = replaceExact(
  server,
  'authenticated-budgeted-fully-fenced-current-reality-result-atomic-economic-outcome-gateway-mounted',
  'authenticated-budgeted-fully-fenced-current-reality-finalized-result-atomic-settled-debit-gateway-mounted',
  "server mount reason"
);
server = replaceExact(
  server,
  '// 5A.24: production creator inference requires explicit UNKNOWN-before-network + fresh dispatch fencing. Generic spend authority can reserve/read only; every creator economic outcome is selected inside durable settlement Mongo transactions.',
  '// 5A.24: production creator inference requires explicit UNKNOWN-before-network + fresh dispatch fencing. Generic spend authority can reserve/read only; creator debit requires exact FINALIZED proof -> atomic SETTLED execution + explicit durable debit lineage in one settlement transaction.',
  "server law"
);
fs.writeFileSync(serverPath, server);

console.log("settlement production capability hardening applied");
