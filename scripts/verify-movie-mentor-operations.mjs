import assert from "node:assert/strict";
import {
  KNOWN_SPECIALIST_IDS,
  createOperationsSupervisorWorkOrder,
  validateOperationsSupervisorWorkOrder,
} from "../ai/MovieMentorOperationsSupervisor.js";
import {
  DEFAULT_ALLOWED_ACTION_IDS,
  createControlledRecoveryRequest,
  validateControlledRecoveryRequest,
  executeControlledRecovery,
} from "../ai/MovieMentorControlledRecoveryExecutor.js";
import { CONTROLLED_ROLLBACK_DEFAULT_ALLOWLIST } from "../ai/MovieMentorControlledRollbackExecutor.js";

const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const validContribution=(agentId)=>({agentId,creatorFacing:false,readOnly:true});

test("canonical roster contains core and verification specialists",()=>{
 for(const id of ["workflow-health","queue-job-health","latency-performance","provider-availability","capacity-demand","incident-evidence","recovery-verification","post-rollback-verification"]) assert.ok(KNOWN_SPECIALIST_IDS.includes(id),`missing ${id}`);
});
test("unknown specialist fails closed",()=>{const w=createOperationsSupervisorWorkOrder({specialistContributions:[validContribution("captains-super-secret-super-agent-9000")]});const r=validateOperationsSupervisorWorkOrder(w);assert.equal(r.valid,false);assert.ok(r.issues.some(x=>x.startsWith("unknown_specialist_identity:")));});
test("known specialist must be explicitly read-only",()=>{const w=createOperationsSupervisorWorkOrder({specialistContributions:[{agentId:"capacity-demand",creatorFacing:false}]});assert.equal(validateOperationsSupervisorWorkOrder(w).valid,false);});
test("known specialist must be explicitly non creator-facing",()=>{const w=createOperationsSupervisorWorkOrder({specialistContributions:[{agentId:"capacity-demand",creatorFacing:true,readOnly:true}]});assert.equal(validateOperationsSupervisorWorkOrder(w).valid,false);});
test("recovery and rollback allowlists are empty by default",()=>{assert.deepEqual(DEFAULT_ALLOWED_ACTION_IDS,[]);assert.deepEqual(CONTROLLED_ROLLBACK_DEFAULT_ALLOWLIST,[]);});

const future=new Date(Date.now()+60_000).toISOString();
const baseRequest=()=>createControlledRecoveryRequest({requestId:"r1",actionId:"approved-test-action",targetScope:{service:"test"},requestedBy:"trusted-runtime",idempotencyKey:"k1",authorisation:{approvalId:"a1",actionId:"approved-test-action",targetScope:{service:"test"},expiresAt:future,explicitApproval:true}});
const verifier=async()=>({valid:true});
const ledger=(result=true)=>({reserve:async()=>result});

test("recovery rejects missing trusted authorisation verifier",async()=>{const r=await validateControlledRecoveryRequest(baseRequest(),{allowedActionIds:["approved-test-action"],executionLedger:ledger()});assert.equal(r.valid,false);assert.ok(r.issues.includes("trusted_authorisation_verifier_required"));});
test("recovery rejects unknown action",async()=>{const r=await validateControlledRecoveryRequest(baseRequest(),{allowedActionIds:[],executionLedger:ledger(),authorisationVerifier:verifier});assert.equal(r.valid,false);assert.ok(r.issues.includes("action_not_allowlisted"));});
test("atomic ledger blocks duplicate execution",async()=>{const r=await executeControlledRecovery(baseRequest(),{allowedActionIds:["approved-test-action"],executionLedger:ledger(false),authorisationVerifier:verifier,adapterRegistry:{"approved-test-action":async()=>({ok:true})}});assert.equal(r.state,"duplicate-request");assert.equal(r.executionPermitted,false);});
test("adapter failure becomes structured failure requiring verification",async()=>{const r=await executeControlledRecovery(baseRequest(),{allowedActionIds:["approved-test-action"],executionLedger:ledger(true),authorisationVerifier:verifier,adapterRegistry:{"approved-test-action":async()=>{throw Object.assign(new Error("boom"),{code:"TEST_FAILURE"});}}});assert.equal(r.state,"execution-failed");assert.equal(r.verificationRequired,true);assert.equal(r.executed,true);});

let failed=0;
for(const [name,fn] of tests){try{await fn();console.log(`PASS ${name}`);}catch(error){failed++;console.error(`FAIL ${name}`);console.error(error);}}
if(failed){console.error(`\nOperations verification failed: ${failed}/${tests.length}`);process.exit(1);}console.log(`\nOperations verification passed: ${tests.length}/${tests.length}`);
