import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorInferenceSettlementReconciliationAuthority} from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";
import {releaseFailedUnclaimedExecution} from "../ai/MovieMentorTurnRuntime.js";

let releaseCalls=0;
const releaseAuthority=createMovieMentorInferenceSettlementReconciliationAuthority({store:{settleCanonicalResult:async()=>({authorized:false,settled:false,outcome:"reserved"}),releaseUnclaimedReservation:async({executionId})=>{releaseCalls++;assert.equal(executionId,"execution-1");return{authorized:true,released:true,outcome:"released",executionId,reservationId:"reservation-1",principalId:"creator-1",projectId:"project-1",idempotent:false};}}});
const released=await releaseFailedUnclaimedExecution({execution:{executionId:"execution-1"},settlementAuthority:releaseAuthority,error:new Error("orchestration failed")});assert.equal(released.authorized,true);assert.equal(released.outcome,"released");assert.equal(releaseCalls,1);
const heldAuthority=createMovieMentorInferenceSettlementReconciliationAuthority({store:{settleCanonicalResult:async()=>({authorized:false,settled:false,outcome:"reserved"}),releaseUnclaimedReservation:async()=>({authorized:false,released:false,outcome:"reserved",reason:"provider-call-claims-exist",providerCallsClaimed:1})}});await assert.rejects(()=>releaseFailedUnclaimedExecution({execution:{executionId:"execution-1"},settlementAuthority:heldAuthority,error:new Error("claim ACK unknown")}),e=>e.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED"&&e.providerCallsClaimed===1);
await assert.rejects(()=>releaseFailedUnclaimedExecution({execution:{executionId:"execution-1"},settlementAuthority:{reconcile:async()=>({})},error:new Error("no release authority")}),e=>e.code==="MOVIE_MENTOR_INFERENCE_RELEASE_AUTHORITY_REQUIRED");

const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8"),settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8"),execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8"),gateway=fs.readFileSync(new URL("../movieMentorTurn.js",import.meta.url),"utf8"),server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
assert.match(runtime,/releaseFailedUnclaimedExecution/);assert.match(runtime,/settlementAuthority\.releaseUnclaimed\(\{executionId:/);assert.doesNotMatch(runtime,/settleTurn\(\{[^}]*reason:\s*["']orchestration-failed-before-provider-claim["']/s);
assert.match(settlement,/releaseUnclaimedReservation/);assert.match(settlement,/session\.withTransaction/);assert.match(settlement,/providerCallsClaimed:\s*0/);assert.match(settlement,/"providerCalls\.0":\s*\{\s*\$exists:\s*false\s*\}/);assert.match(settlement,/phase:\s*"aborted"/);assert.match(settlement,/settlementRealityBarrierRevision:\s*1/);assert.match(settlement,/remainingUnits:\s*reservation\.units/);assert.match(settlement,/status:\s*"released"/);
assert.match(execution,/"aborted"/);assert.match(execution,/phase\s*===\s*"aborted"/);assert.match(execution,/calls\.length\s*!==\s*0/);assert.match(execution,/MOVIE_MENTOR_INFERENCE_EXECUTION_ABORT_RECORD_INVALID/);
assert.match(gateway,/atomicUnclaimedReleaseRequired:true/);assert.match(gateway,/processLocalClaimCountCannotAuthorizeRelease:true/);assert.match(server,/authority\?\.releaseUnclaimed!=="function"/);assert.match(server,/process-local callers cannot declare either economic outcome/);
console.log("5A.24 atomic unclaimed reservation release catastrophe gate: GREEN");
console.log("✓ a process-local zero claim count cannot authorize release");
console.log("✓ release requires one transaction that writes the execution document before restoring entitlement units");
console.log("✓ the execution transitions ACTIVE -> ABORTED in the same transaction, permanently revoking future provider-call authority");
console.log("✓ a concurrent or ACK-lost durable provider claim keeps spend RESERVED and fails closed");
console.log("LAW: NO ATOMIC ZERO-CLAIM EXECUTION ABORT + RESERVATION RELEASE -> NO CREATOR CREDIT RESTORATION");
