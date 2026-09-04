import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import {createMovieMentorCanonicalResultAuthority} from "../ai/MovieMentorCanonicalResultAuthority.js";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";

const executionSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const settlementSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const canonicalStoreSource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
const canonicalAuthoritySource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultAuthority.js",import.meta.url),"utf8");
const closureAuthoritySource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js",import.meta.url),"utf8");
const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const gatewaySource=fs.readFileSync(new URL("../movieMentorTurn.js",import.meta.url),"utf8");

const schemaMatch=executionSource.match(/const VERSION="[^"]+",DOMAIN="iband\.movie-mentor\.inference-execution-store",SCHEMA=(\d+)/);
assert.ok(schemaMatch,"execution store must expose a statically auditable current durable schema");
const currentSchema=Number(schemaMatch[1]);
assert.ok(Number.isSafeInteger(currentSchema)&&currentSchema>0);

const settlementSchemas=settlementSource.match(/!\[([^\]]+)\]\.includes\(execution\.schema\)/)?.[1]?.split(",").map(Number)??[];
const canonicalSchemas=canonicalStoreSource.match(/\[([^\]]+)\]\.includes\(execution\.schema\)/)?.[1]?.split(",").map(Number)??[];
assert.ok(settlementSchemas.includes(currentSchema),`current execution schema ${currentSchema} must cross settlement boundary`);
assert.ok(canonicalSchemas.includes(currentSchema),`current execution schema ${currentSchema} must cross canonical finalization boundary`);
assert.match(settlementSource,new RegExp(`executionSchemaCompatibility:\"[^\"]*${currentSchema}[^\"]*\"`));
assert.match(canonicalStoreSource,new RegExp(`executionSchemaCompatibility:\"[^\"]*${currentSchema}[^\"]*\"`));

assert.match(runtimeSource,/if \(s\(existing\.phase\) === "quarantined"\)/);
assert.match(runtimeSource,/MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED/);
assert.match(runtimeSource,/retryable: false/);
assert.match(gatewaySource,/MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED"\s*\)\s*return 409/);
assert.match(gatewaySource,/quarantinedExecutionIsNonRetryableConflict:true/);
assert.match(gatewaySource,/quarantinedExecutionFailClosed:true/);

assert.match(settlementSource,/phase==="quarantined"\?"execution-quarantined"/);
assert.match(settlementSource,/if\(text\(execution\.phase\)==="aborted"\)/);
assert.match(settlementSource,/if\(text\(execution\.phase\)!=="active"\)/);
assert.match(settlementSource,/if\(execution\)\{outcome=Object\.freeze\(\{released:false,authorized:false,outcome:"reserved",reason:"reservation-already-bound-to-execution"/);
assert.match(settlementSource,/MOVIE_MENTOR_INFERENCE_RELEASE_CONSUMED_CONFLICT/);
assert.match(settlementSource,/MOVIE_MENTOR_INFERENCE_UNBOUND_RELEASE_CONSUMED_CONFLICT/);

assert.match(executionSource,/quarantinedFromPhase:current\.phase/);
assert.match(executionSource,/proofPhase=phase==="quarantined"\?quarantinedFromPhase:phase/);
assert.match(executionSource,/proofPhase==="settled"/);
assert.match(closureAuthoritySource,/quarantinedFromPhase:text\(record\.quarantinedFromPhase\)\|\|null/);
assert.match(closureAuthoritySource,/revoked:true/);
assert.match(canonicalAuthoritySource,/canonical-result-historical-revoked/);

const historicalRecord={resultReference:"result-history",candidateReference:"candidate-history",executionId:"execution-history",creatorTurnId:"turn-history",principalId:"creator-history",projectId:"project-history",reservationId:"reservation-history",requestDigest:"request-history",closureReference:"closure-history",closureCertificateDigest:"closure-digest-history",resultDigest:"digest-history",resultPayload:{text:"historical-only"},committedAt:"2032-01-01T00:00:00.000Z"};
let candidateReads=0;
const canonicalAuthority=createMovieMentorCanonicalResultAuthority({
  store:{readByExecution:async()=>historicalRecord,commit:async()=>{throw new Error("revoked history must never recommit");}},
  assertCurrentClosure:async()=>({authorized:false,closed:false,currentRealityVerified:false,phase:"quarantined",quarantined:true,revoked:true,quarantinedFromPhase:"settled",reason:"late-provider-effect-conflict"}),
  readResultCandidate:async()=>{candidateReads+=1;throw new Error("revoked historical read must not inspect candidate as current authority");},
});
const historical=await canonicalAuthority.readResult({executionId:"execution-history"});
assert.equal(historical.authorized,false);
assert.equal(historical.committed,true);
assert.equal(historical.revoked,true);
assert.equal(historical.quarantined,true);
assert.equal(historical.reason,"canonical-result-historical-revoked");
assert.equal(historical.quarantinedFromPhase,"settled");
assert.equal(historical.quarantineReason,"late-provider-effect-conflict");
assert.equal(historical.resultReference,"result-history");
assert.equal(historical.reservationId,"reservation-history");
assert.equal("resultPayload" in historical,false,"historical visibility must not smuggle revoked creator-facing payload into an authority-shaped response");
assert.equal(candidateReads,0);

// Prove the actual Express gateway preserves revocation semantics instead of translating it into a retryable 5xx.
const noop=async()=>({});
const executionAuthority={
  findExecutionByCreatorTurn:noop,openExecution:noop,acquireExecution:noop,assertFence:noop,claimProviderCall:noop,
  beginProviderDispatch:noop,assertProviderDispatch:noop,contributeProviderEffectEvidence:noop,stageResultCandidate:noop,
  readResultCandidate:noop,beginExecutionClosing:noop,reconcileExecutionClosure:noop,assertCurrentExecutionClosure:noop,
  commitCanonicalResult:noop,readCanonicalResult:noop,
};
const spendAuthority={reserveTurn:noop,readReservation:noop};
const settlementAuthority={reconcile:noop,releaseUnclaimed:noop,releaseUnbound:noop};
const quarantineError=Object.assign(new Error("durably quarantined"),{code:"MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED",retryable:false,quarantinedFromPhase:"settled"});
const router=createMovieMentorTurnRouter({
  requestAuthority:{authorize:async()=>({authorized:true,projectId:"project-gateway",principalId:"creator-gateway",ownershipRef:"owner-ref"})},
  inferenceSpendAuthority:spendAuthority,
  inferenceExecutionAuthority:executionAuthority,
  inferenceSettlementAuthority:settlementAuthority,
  runTurn:async()=>{throw quarantineError;},
  applyStateTransition:noop,
});
const app=express();app.use(express.json());app.use("/movie-mentor",router);
const loopback=["127","0","0","1"].join(".");
const server=await new Promise(resolve=>{const value=app.listen(0,loopback,()=>resolve(value));});
try{
  const address=server.address();
  assert.ok(address&&typeof address!=="string");
  const target=new URL(`/movie-mentor/turn`,`http://${loopback}:${address.port}`);
  const response=await fetch(target,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId:"project-gateway",message:"retry old turn",creatorTurnId:"turn-gateway"})});
  const body=await response.json();
  assert.equal(response.status,409);
  assert.equal(body.success,false);
  assert.equal(body.code,"MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED");
  assert.equal(body.retryable,false);
  assert.equal(body.authority?.quarantinedExecutionIsNonRetryableConflict,true);
}finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

console.log("ROUND SEVEN revoked-reality authority catastrophe gate: GREEN");
console.log(`✓ current durable execution schema ${currentSchema} crosses settlement + canonical finalization boundaries`);
console.log("✓ actual Express gateway returns QUARANTINED as HTTP 409 + retryable=false, never a retry invitation");
console.log("✓ canonical result remains historically identifiable after quarantine but authorized=false and payload-free");
console.log("✓ quarantine closure evidence preserves exact prior proof-bearing phase without converting history back into current reality");
console.log("✓ consumed economic history cannot be released by post-settlement or unbound release paths");
console.log("LAW: HISTORY MAY SURVIVE REVOCATION. AUTHORITY MAY NOT. CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED.");
