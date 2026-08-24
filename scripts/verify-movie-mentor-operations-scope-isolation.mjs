import assert from "node:assert/strict";
import { createOperationsScope, validateOperationsScope, compareOperationsScopes, createScopedEvidenceEnvelope, validateScopedEvidenceEnvelope, verifyScopedEvidenceEnvelope } from "../ai/MovieMentorOperationsScopeIsolationControl.js";

const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const base=()=>createOperationsScope({scopeId:"ops-i1",incidentId:"i1",environment:"production",service:"movie-mentor",region:"uk",projectId:"proj1",creatorSessionId:"sess1",correlationId:"corr1"});
const envelope=(scope=base())=>createScopedEvidenceEnvelope({envelopeId:"e1",sourceRuntimeIdentity:"capacity-demand",evidenceReference:"ev://1",evidenceType:"capacity",scope,capturedAt:"2026-08-24T18:00:00Z"});

test("canonical scope validates",()=>assert.equal(validateOperationsScope(base()).valid,true));
test("forged fingerprint is rejected",()=>{const s=base();s.descriptor.incidentId="i2";const r=validateOperationsScope(s);assert.equal(r.valid,false);assert.ok(r.issues.includes("scope_fingerprint_invalid"))});
test("cross incident evidence is rejected",()=>{const actual=createOperationsScope({...base().descriptor,incidentId:"i2"});const r=compareOperationsScopes(base(),actual);assert.equal(r.valid,false);assert.ok(r.issues.includes("scope_incidentId_mismatch"))});
test("staging evidence cannot enter production scope",()=>{const actual=createOperationsScope({...base().descriptor,environment:"staging"});const r=validateScopedEvidenceEnvelope(envelope(actual),base());assert.equal(r.valid,false);assert.ok(r.issues.includes("scope_environment_mismatch"))});
test("different project cannot cross scope",()=>{const actual=createOperationsScope({...base().descriptor,projectId:"proj2"});const r=validateScopedEvidenceEnvelope(envelope(actual),base());assert.equal(r.valid,false);assert.ok(r.issues.includes("scope_projectId_mismatch"))});
test("different creator session cannot cross scope",()=>{const actual=createOperationsScope({...base().descriptor,creatorSessionId:"sess2"});const r=validateScopedEvidenceEnvelope(envelope(actual),base());assert.equal(r.valid,false);assert.ok(r.issues.includes("scope_creatorSessionId_mismatch"))});
test("matching envelope still requires trusted external scope attestation",async()=>{const r=await verifyScopedEvidenceEnvelope(envelope(),base());assert.equal(r.verified,false);assert.ok(r.reasons.includes("trusted_scope_attestation_verifier_required"))});
test("trusted scope attestation requires traceable reference",async()=>{const r=await verifyScopedEvidenceEnvelope(envelope(),base(),{verifyScopeAttestation:async()=>({valid:true})});assert.equal(r.verified,false);assert.ok(r.reasons.includes("trusted_scope_attestation_reference_required"))});
test("matching externally attested envelope is accepted",async()=>{const r=await verifyScopedEvidenceEnvelope(envelope(),base(),{verifyScopeAttestation:async()=>({valid:true,reference:"scope-attest-1"})});assert.equal(r.verified,true);assert.equal(r.reference,"scope-attest-1")});

let failed=0;for(const[name,fn]of tests){try{await fn();console.log(`PASS ${name}`)}catch(error){failed++;console.error(`FAIL ${name}`);console.error(error)}}if(failed){console.error(`\nOperations scope isolation verification failed: ${failed}/${tests.length}`);process.exit(1)}console.log(`\nOperations scope isolation verification passed: ${tests.length}/${tests.length}`);
