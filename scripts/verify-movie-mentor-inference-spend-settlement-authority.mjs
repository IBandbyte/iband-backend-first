import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";

const binding={authenticated:true,projectAuthorized:true,principalId:"creator-1",projectId:"project-1"};
function memoryStore(){let state="reserved";return{reserve:async q=>({granted:true,reservation:{...q,status:"reserved",entitlementRevision:2}}),settle:async q=>{if(state!=="reserved"&&state!==q.outcome){const e=new Error("conflict");e.code="MOVIE_MENTOR_INFERENCE_SPEND_SETTLEMENT_CONFLICT";throw e;}const idempotent=state===q.outcome;state=q.outcome;return{settled:true,idempotent,reservation:{reservationId:q.reservationId,principalId:q.principalId,projectId:"project-1",operation:"movie-mentor-turn",units:1,entitlementRevision:3,status:state}};}};}
{
 const store=memoryStore(),authority=createMovieMentorInferenceSpendAuthority({store,createReservationId:()=>"r1"}),reservation=await authority.reserveTurn({serverAuthority:binding,projectId:"project-1"});
 const first=await authority.settleTurn({reservation,outcome:"consumed"});const retry=await authority.settleTurn({reservation,outcome:"consumed"});assert.equal(first.outcome,"consumed");assert.equal(retry.idempotent,true);await assert.rejects(()=>authority.settleTurn({reservation,outcome:"released"}),e=>e.code==="MOVIE_MENTOR_INFERENCE_SPEND_SETTLEMENT_CONFLICT");
}
const storeSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");
const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const resultSource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultAuthority.js",import.meta.url),"utf8");
const reconciliationSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementReconciliationAuthority.js",import.meta.url),"utf8");
assert.match(storeSource,/enum:\["reserved","consumed","released"\]/);assert.match(storeSource,/reservedUnits:-durable\.units,consumedUnits:durable\.units/);assert.match(storeSource,/reservedUnits:-durable\.units,remainingUnits:durable\.units/);assert.match(storeSource,/withTransaction/);
assert.match(runtimeSource,/outcome:"released"/);assert.doesNotMatch(runtimeSource,/settleTurn\(\{reservation,outcome:"consumed"/);assert.match(runtimeSource,/commitCanonicalResult/);assert.match(runtimeSource,/settlementAuthority\.reconcile/);assert.match(runtimeSource,/settlement:"consumed"/);
assert.match(resultSource,/reservationId:current\.reservationId/);assert.match(reconciliationSource,/outcome:"consumed"/);assert.match(reconciliationSource,/readCanonicalResult/);assert.match(reconciliationSource,/MOVIE_MENTOR_SETTLEMENT_CANONICAL_BINDING_CONFLICT/);
const reserveBoundary=runtimeSource.indexOf("reservation=await spendAuthority.reserveTurn(");const orchestrateBoundary=runtimeSource.indexOf("result=await orchestrate(");const canonicalBoundary=runtimeSource.indexOf("canonical=await inferenceExecutionAuthority.commitCanonicalResult(");const reconcileBoundary=runtimeSource.indexOf("settlement=await settlementAuthority.reconcile(");assert.ok(reserveBoundary>=0&&orchestrateBoundary>=0&&canonicalBoundary>=0&&reconcileBoundary>=0);assert.ok(reserveBoundary<orchestrateBoundary);assert.ok(orchestrateBoundary<canonicalBoundary);assert.ok(canonicalBoundary<reconcileBoundary);
console.log("PASS Door 5A.8 regression — atomic/idempotent spend settlement remains intact; creator debit is now selected only by deterministic reconciliation from current immutable canonical result authority.");
