import assert from "node:assert/strict";
import { createFreshnessToken, validateFreshnessToken, claimFreshnessToken } from "../ai/MovieMentorOperationsReplayFreshnessControl.js";

const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const now=Date.parse("2026-08-24T18:00:00Z");
const token=(overrides={})=>createFreshnessToken({kind:"recovery-verification",incidentId:"i1",subjectId:"rex-1",nonce:"nonce-1",issuedAt:"2026-08-24T17:59:00Z",expiresAt:"2026-08-24T18:05:00Z",correlationId:"corr-1",stateSequence:7,...overrides});
const expectations={expectedKind:"recovery-verification",expectedIncidentId:"i1",expectedSubjectId:"rex-1",expectedCorrelationId:"corr-1",expectedStateSequence:7,now};

test("fresh correlated token is valid",()=>{const r=validateFreshnessToken(token(),expectations);assert.equal(r.valid,true);assert.ok(r.replayKey.includes("nonce-1"))});
test("expired verification token fails closed",()=>{const r=validateFreshnessToken(token({expiresAt:"2026-08-24T17:50:00Z"}),expectations);assert.equal(r.valid,false);assert.ok(r.issues.includes("freshness_expired")||r.issues.includes("freshness_window_invalid"))});
test("future-dated token beyond skew fails closed",()=>{const r=validateFreshnessToken(token({issuedAt:"2026-08-24T18:10:00Z",expiresAt:"2026-08-24T18:12:00Z"}),expectations);assert.equal(r.valid,false);assert.ok(r.issues.includes("freshness_not_yet_valid"))});
test("overlong validity window is rejected",()=>{const r=validateFreshnessToken(token({issuedAt:"2026-08-24T17:00:00Z",expiresAt:"2026-08-24T19:00:00Z"}),expectations);assert.equal(r.valid,false);assert.ok(r.issues.includes("freshness_window_too_long"))});
test("cross-incident replay is rejected",()=>{const r=validateFreshnessToken(token({incidentId:"i2"}),expectations);assert.equal(r.valid,false);assert.ok(r.issues.includes("freshness_incident_mismatch"))});
test("cross-execution replay is rejected",()=>{const r=validateFreshnessToken(token({subjectId:"rex-2"}),expectations);assert.equal(r.valid,false);assert.ok(r.issues.includes("freshness_subject_mismatch"))});
test("state-sequence replay is rejected",()=>{const r=validateFreshnessToken(token({stateSequence:6}),expectations);assert.equal(r.valid,false);assert.ok(r.issues.includes("freshness_state_sequence_mismatch"))});
test("single-use claim requires trusted atomic ledger",async()=>{const r=await claimFreshnessToken(token(),expectations,{now});assert.equal(r.claimed,false);assert.ok(r.reasons.includes("trusted_single_use_ledger_required"))});
test("single-use ledger prevents replay",async()=>{const used=new Set();const ledger={claim:async({replayKey})=>{if(used.has(replayKey))return{claimed:false,reason:"already_consumed"};used.add(replayKey);return{claimed:true,reference:`claim:${replayKey}`}}};const first=await claimFreshnessToken(token(),expectations,{singleUseLedger:ledger,now});assert.equal(first.claimed,true);const second=await claimFreshnessToken(token(),expectations,{singleUseLedger:ledger,now});assert.equal(second.claimed,false);assert.ok(second.reasons.includes("already_consumed"))});

let failed=0;for(const[name,fn]of tests){try{await fn();console.log(`PASS ${name}`)}catch(error){failed++;console.error(`FAIL ${name}`);console.error(error)}}if(failed){console.error(`\nOperations replay/freshness verification failed: ${failed}/${tests.length}`);process.exit(1)}console.log(`\nOperations replay/freshness verification passed: ${tests.length}/${tests.length}`);
