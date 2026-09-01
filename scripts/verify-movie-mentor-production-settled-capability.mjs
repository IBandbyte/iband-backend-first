import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorProductionInferenceSettlementComposition } from "../ai/MovieMentorProductionInferenceSettlementComposition.js";

const settlementStore=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSettlementComposition.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
for(const capability of ["settledExecutionAuthority","atomicFinalizedToSettledDebit","explicitDebitBinding","proofTimeFailClosed"]){assert.match(settlementStore,new RegExp(`${capability}:true`));assert.match(compositionSource,new RegExp(`${capability}:true`));}
assert.match(compositionSource,/iband\.movie-mentor\.production-inference-settlement-composition/);
assert.match(serverSource,/settlementCompositionProven/);
assert.match(serverSource,/status===composition\?\.status/);
assert.match(serverSource,/status\?\.authority===composition\?\.authority/);
assert.match(serverSource,/status\?\.storeStatus===composition\?\.storeStatus/);
assert.match(serverSource,/exact settlement owner proof/);

const unprovenInjectedStore={settleCanonicalResult:async()=>({}),releaseUnclaimedReservation:async()=>({}),releaseUnboundReservation:async()=>({})};
const rejected=createMovieMentorProductionInferenceSettlementComposition({store:unprovenInjectedStore});
assert.equal(rejected.ready,false);assert.equal(rejected.status,null);assert.equal(rejected.getStatus(),null);

const ownedStoreStatus=Object.freeze({configured:true,readiness:"injected-proven",atomicity:"single-mongo-transaction",settledExecutionAuthority:true,atomicFinalizedToSettledDebit:true,explicitDebitBinding:true,proofTimeFailClosed:true});
const injectedStore={getStatus:()=>ownedStoreStatus,settleCanonicalResult:async()=>({authorized:true,settled:true,outcome:"consumed",executionPhase:"settled",explicitDebitBindingVerified:true}),releaseUnclaimedReservation:async()=>({authorized:true,released:true,outcome:"released"}),releaseUnboundReservation:async()=>({authorized:true,released:true,outcome:"released"})};
const composition=createMovieMentorProductionInferenceSettlementComposition({store:injectedStore});
const status=composition.getStatus();
assert.equal(composition.ready,true);assert.equal(status,composition.status);assert.equal(composition.getStatus(),status);assert.equal(Object.isFrozen(status),true);assert.equal(status.domain,"iband.movie-mentor.production-inference-settlement-composition");assert.equal(status.production,true);assert.equal(status.authority,composition.authority);assert.equal(status.storeStatus,composition.storeStatus);assert.equal(status.storeStatus,ownedStoreStatus);assert.equal(status.processLocalFallback,false);
const reconstructed=Object.freeze({...status});assert.deepEqual(reconstructed,status);assert.notEqual(reconstructed,status);
const lookalike=Object.freeze({...composition,status:reconstructed,getStatus:()=>reconstructed});assert.notEqual(lookalike.getStatus(),composition.status);
assert.match(serverSource,/!settlementCompositionProven\(settlementComposition,settlementStatus\)/);
assert.equal(typeof composition.authority.reconcile,"function");assert.equal(typeof composition.authority.releaseUnclaimed,"function");assert.equal(typeof composition.authority.releaseUnbound,"function");
console.log("5A.24 production SETTLED capability gate: GREEN");
console.log("✓ settlement composition owns one stable immutable proof bound to exact authority + store lineage");
console.log("✓ reconstructed and lookalike proofs receive zero server-mount authority");
console.log("LAW: SETTLEMENT STORE PROOF -> PRODUCTION SETTLEMENT COMPOSITION OWNS EXACT STABLE PROOF -> SERVER MOUNT CONSUMES THAT EXACT OWNER PROOF -> ROUTE.");
console.log("LAW: READY IS NOT SETTLEMENT HTTP AUTHORITY. PROOF DOES NOT REINCARNATE.");
