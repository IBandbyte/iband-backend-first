import assert from "node:assert/strict";
import {KNOWN_SPECIALIST_IDS,createOperationsSupervisorWorkOrder,validateOperationsSupervisorWorkOrder} from "../ai/MovieMentorOperationsSupervisor.js";
import {DEFAULT_ALLOWED_ACTION_IDS,createControlledRecoveryRequest,validateControlledRecoveryRequest,executeControlledRecovery} from "../ai/MovieMentorControlledRecoveryExecutor.js";
import {CONTROLLED_ROLLBACK_DEFAULT_ALLOWLIST} from "../ai/MovieMentorControlledRollbackExecutor.js";
import {createAgentHealthIntegrityWorkOrder,validateAgentHealthIntegrityWorkOrder} from "../ai/MovieMentorAgentHealthIntegrityAgent.js";
import {DEFAULT_AGENT_REGISTRY,createAgentAdmissionRequest,evaluateAgentAdmission,createQuarantineRecord,evaluateQuarantineRelease} from "../ai/MovieMentorAgentAdmissionQuarantineControl.js";
import {createOperationsState,evaluateOperationsTransition} from "../ai/MovieMentorOperationsStateMachine.js";

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const validContribution=(agentId)=>({agentId,creatorFacing:false,readOnly:true});

test("canonical roster contains core, verification and integrity specialists",()=>{
  for(const id of ["workflow-health-bottleneck","queue-job-health","latency-performance","provider-availability-resilience","capacity-demand","incident-evidence-timeline","recovery-verification","post-rollback-verification","agent-health-integrity"]){
    assert.ok(KNOWN_SPECIALIST_IDS.includes(id),`missing ${id}`);
  }
});

test("unknown specialist fails closed",()=>{
  const r=validateOperationsSupervisorWorkOrder(createOperationsSupervisorWorkOrder({specialistContributions:[validContribution("captains-super-secret-super-agent-9000")]}));
  assert.equal(r.valid,false);
  assert.ok(r.issues.some(x=>x.startsWith("unknown_specialist_identity:")));
});

test("known specialist must be explicitly read-only",()=>{
  assert.equal(validateOperationsSupervisorWorkOrder(createOperationsSupervisorWorkOrder({specialistContributions:[{agentId:"capacity-demand",creatorFacing:false}]})).valid,false);
});

test("known specialist must be explicitly non creator-facing",()=>{
  assert.equal(validateOperationsSupervisorWorkOrder(createOperationsSupervisorWorkOrder({specialistContributions:[{agentId:"capacity-demand",creatorFacing:true,readOnly:true}]})).valid,false);
});

test("agent health integrity work order is independently read-only",()=>{
  const w=createAgentHealthIntegrityWorkOrder({targetAgentRuntimeIdentity:"queue-job-health"});
  assert.equal(validateAgentHealthIntegrityWorkOrder(w).valid,true);
  assert.equal(validateAgentHealthIntegrityWorkOrder({...w,readOnly:false}).valid,false);
  assert.equal(validateAgentHealthIntegrityWorkOrder({...w,independentAssessment:false}).valid,false);
});

test("recovery and rollback allowlists are empty by default",()=>{
  assert.deepEqual(DEFAULT_ALLOWED_ACTION_IDS,[]);
  assert.deepEqual(CONTROLLED_ROLLBACK_DEFAULT_ALLOWLIST,[]);
});

test("agent admission registry is empty by default",()=>{
  assert.deepEqual(DEFAULT_AGENT_REGISTRY,{});
});

const registry={"queue-job-health":{enabled:true,contractVersion:"1.0.0",agentVersion:"1.0.0",authority:"operations-analysis-only"}};
const admission=(overrides={})=>createAgentAdmissionRequest({trustedRuntimeIdentity:"queue-job-health",claimedAgentIdentity:"queue-job-health",contractVersion:"1.0.0",agentVersion:"1.0.0",...overrides});

test("registered trusted runtime identity is admitted when healthy",()=>{
  const r=evaluateAgentAdmission(admission(),{registry,quarantineState:{}});
  assert.equal(r.admitted,true);
  assert.equal(r.state,"admitted");
});

test("unknown runtime identity fails closed",()=>{
  const r=evaluateAgentAdmission(admission({trustedRuntimeIdentity:"captains-super-secret-super-agent-9000",claimedAgentIdentity:"captains-super-secret-super-agent-9000"}),{registry});
  assert.equal(r.admitted,false);
  assert.equal(r.state,"denied-unknown-identity");
});

test("claimed identity cannot override trusted runtime identity",()=>{
  const r=evaluateAgentAdmission(admission({claimedAgentIdentity:"operations-supervisor"}),{registry});
  assert.equal(r.admitted,false);
  assert.equal(r.state,"denied-identity-mismatch");
});

test("quarantined agent cannot be admitted",()=>{
  const r=evaluateAgentAdmission(admission(),{registry,quarantineState:{"queue-job-health":{quarantined:true,reference:"q1"}}});
  assert.equal(r.admitted,false);
  assert.equal(r.state,"denied-quarantined");
});

test("quarantine release requires repair evidence",async()=>{
  const record=createQuarantineRecord({trustedRuntimeIdentity:"queue-job-health",reference:"q1",reasons:["contract violation"]});
  const r=await evaluateQuarantineRelease({trustedRuntimeIdentity:"queue-job-health",quarantineRecord:record,repairEvidence:[],verificationEvidence:["verified"]},{verifyReleaseAuthorisation:async()=>({authorised:true})});
  assert.equal(r.released,false);
  assert.equal(r.state,"release-review-required");
});

test("quarantine release requires independent verification evidence",async()=>{
  const record=createQuarantineRecord({trustedRuntimeIdentity:"queue-job-health",reference:"q1"});
  const r=await evaluateQuarantineRelease({trustedRuntimeIdentity:"queue-job-health",quarantineRecord:record,repairEvidence:["patch tested"],verificationEvidence:[]},{verifyReleaseAuthorisation:async()=>({authorised:true})});
  assert.equal(r.released,false);
  assert.equal(r.state,"release-review-required");
});

test("quarantine release requires trusted external authorisation",async()=>{
  const record=createQuarantineRecord({trustedRuntimeIdentity:"queue-job-health",reference:"q1"});
  const r=await evaluateQuarantineRelease({trustedRuntimeIdentity:"queue-job-health",quarantineRecord:record,repairEvidence:["patch tested"],verificationEvidence:["independent pass"]});
  assert.equal(r.released,false);
  assert.equal(r.state,"release-denied");
});

const transitionEvidence=["test evidence"];
const transitionAuthoriser=async()=>({authorised:true,reference:"auth-test"});

test("state machine blocks healthy to rollback jump",async()=>{
  const state=createOperationsState({state:"healthy",incidentId:"i1"});
  const r=await evaluateOperationsTransition(state,"authorise-rollback",{evidence:transitionEvidence,verifyTransitionAuthorisation:transitionAuthoriser});
  assert.equal(r.permitted,false);
  assert.equal(r.reason,"transition_not_allowed");
});

test("state machine requires evidence even for observational transition",async()=>{
  const state=createOperationsState({state:"healthy",incidentId:"i1"});
  const r=await evaluateOperationsTransition(state,"detect-incident",{evidence:[]});
  assert.equal(r.permitted,false);
  assert.equal(r.reason,"transition_evidence_required");
});

test("state machine blocks mutating transition without trusted authoriser",async()=>{
  const state=createOperationsState({state:"awaiting-recovery-authorisation",incidentId:"i1"});
  const r=await evaluateOperationsTransition(state,"authorise-recovery",{evidence:transitionEvidence});
  assert.equal(r.permitted,false);
  assert.equal(r.reason,"trusted_transition_authorisation_verifier_required");
});

test("state machine cannot skip recovery verification",async()=>{
  const state=createOperationsState({state:"recovering",incidentId:"i1"});
  const r=await evaluateOperationsTransition(state,"sustained-health-confirmed",{evidence:transitionEvidence});
  assert.equal(r.permitted,false);
  assert.equal(r.reason,"transition_not_allowed");
});

test("quarantined agent cannot self-release directly to healthy",async()=>{
  const state=createOperationsState({state:"quarantined",incidentId:"i1"});
  const r=await evaluateOperationsTransition(state,"sustained-health-confirmed",{evidence:["agent says I am fine"]});
  assert.equal(r.permitted,false);
  assert.equal(r.reason,"transition_not_allowed");
});

test("legal recovery path preserves mandatory verification",async()=>{
  let state=createOperationsState({state:"incident-detected",incidentId:"i1"});
  state=await evaluateOperationsTransition(state,"begin-diagnosis",{evidence:transitionEvidence});
  assert.equal(state.state,"diagnosing");
  state=await evaluateOperationsTransition(state,"request-recovery-authorisation",{evidence:transitionEvidence});
  assert.equal(state.state,"awaiting-recovery-authorisation");
  state=await evaluateOperationsTransition(state,"authorise-recovery",{evidence:transitionEvidence,authorisation:{id:"a1"},verifyTransitionAuthorisation:transitionAuthoriser});
  assert.equal(state.state,"recovery-authorised");
  state=await evaluateOperationsTransition(state,"begin-recovery",{evidence:transitionEvidence,authorisation:{id:"a1"},verifyTransitionAuthorisation:transitionAuthoriser});
  assert.equal(state.state,"recovering");
  state=await evaluateOperationsTransition(state,"recovery-execution-complete",{evidence:transitionEvidence});
  assert.equal(state.state,"verifying-recovery");
  state=await evaluateOperationsTransition(state,"verification-passed",{evidence:transitionEvidence});
  assert.equal(state.state,"recovered");
  state=await evaluateOperationsTransition(state,"sustained-health-confirmed",{evidence:transitionEvidence});
  assert.equal(state.state,"healthy");
});

test("legal rollback path requires separate authorisation and verification",async()=>{
  let state=createOperationsState({state:"verifying-recovery",incidentId:"i2"});
  state=await evaluateOperationsTransition(state,"verification-requires-rollback",{evidence:transitionEvidence});
  assert.equal(state.state,"awaiting-rollback-authorisation");
  state=await evaluateOperationsTransition(state,"authorise-rollback",{evidence:transitionEvidence,authorisation:{id:"rb1"},verifyTransitionAuthorisation:transitionAuthoriser});
  assert.equal(state.state,"rollback-authorised");
  state=await evaluateOperationsTransition(state,"begin-rollback",{evidence:transitionEvidence,authorisation:{id:"rb1"},verifyTransitionAuthorisation:transitionAuthoriser});
  assert.equal(state.state,"rolling-back");
  state=await evaluateOperationsTransition(state,"rollback-execution-complete",{evidence:transitionEvidence});
  assert.equal(state.state,"verifying-rollback");
  state=await evaluateOperationsTransition(state,"verification-passed",{evidence:transitionEvidence});
  assert.equal(state.state,"recovered");
});

test("unknown state machine event fails closed",async()=>{
  const state=createOperationsState({state:"healthy",incidentId:"i3"});
  const r=await evaluateOperationsTransition(state,"captain-hit-it-with-bat",{evidence:transitionEvidence});
  assert.equal(r.permitted,false);
  assert.equal(r.reason,"transition_not_allowed");
});

const future=new Date(Date.now()+60000).toISOString();
const baseRequest=()=>createControlledRecoveryRequest({requestId:"r1",actionId:"approved-test-action",targetScope:{service:"test"},requestedBy:"trusted-runtime",idempotencyKey:"k1",authorisation:{approvalId:"a1",actionId:"approved-test-action",targetScope:{service:"test"},expiresAt:future,explicitApproval:true}});
const verifier=async()=>({valid:true});
const ledger=(result=true)=>({reserve:async()=>result});

test("recovery rejects missing trusted authorisation verifier",async()=>{
  const r=await validateControlledRecoveryRequest(baseRequest(),{allowedActionIds:["approved-test-action"],executionLedger:ledger()});
  assert.equal(r.valid,false);
  assert.ok(r.issues.includes("trusted_authorisation_verifier_required"));
});

test("recovery rejects unknown action",async()=>{
  const r=await validateControlledRecoveryRequest(baseRequest(),{allowedActionIds:[],executionLedger:ledger(),authorisationVerifier:verifier});
  assert.equal(r.valid,false);
  assert.ok(r.issues.includes("action_not_allowlisted"));
});

test("atomic ledger blocks duplicate execution",async()=>{
  const r=await executeControlledRecovery(baseRequest(),{allowedActionIds:["approved-test-action"],executionLedger:ledger(false),authorisationVerifier:verifier,adapterRegistry:{"approved-test-action":async()=>({ok:true})}});
  assert.equal(r.state,"duplicate-request");
  assert.equal(r.executionPermitted,false);
});

test("adapter failure becomes structured failure requiring verification",async()=>{
  const r=await executeControlledRecovery(baseRequest(),{allowedActionIds:["approved-test-action"],executionLedger:ledger(true),authorisationVerifier:verifier,adapterRegistry:{"approved-test-action":async()=>{throw Object.assign(new Error("boom"),{code:"TEST_FAILURE"});}}});
  assert.equal(r.state,"execution-failed");
  assert.equal(r.verificationRequired,true);
  assert.equal(r.executed,true);
});

let failed=0;
for(const [name,fn] of tests){
  try{await fn();console.log(`PASS ${name}`);}
  catch(error){failed++;console.error(`FAIL ${name}`);console.error(error);}
}
if(failed){console.error(`\nOperations verification failed: ${failed}/${tests.length}`);process.exit(1);}
console.log(`\nOperations verification passed: ${tests.length}/${tests.length}`);
