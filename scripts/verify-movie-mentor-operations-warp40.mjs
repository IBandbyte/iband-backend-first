import assert from "node:assert/strict";
import {
  createOperationsSupervisorWorkOrder,
  validateOperationsSupervisorWorkOrder,
} from "../ai/MovieMentorOperationsSupervisor.js";
import {
  admitRuntimeSpecialist,
  bindContributionToAdmission,
  validateRecoveryExecutionAgainstState,
  validateRollbackExecutionAgainstState,
} from "../ai/MovieMentorOperationsControlPlane.js";
import {
  createOperationsState,
  evaluateOperationsTransition,
} from "../ai/MovieMentorOperationsStateMachine.js";
import { createControlledRecoveryRequest } from "../ai/MovieMentorControlledRecoveryExecutor.js";
import { createControlledRollbackRequest } from "../ai/MovieMentorControlledRollbackExecutor.js";

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const authoriser=async()=>({authorised:true,reference:"trusted-auth-1"});
const CAPACITY_PATH="ai/MovieMentorCapacityDemandAgent.js";
const capacityManifest={
  id:"capacity-demand",
  version:"1.0.0",
  contractVersion:"1.0.0",
  authority:"operations-capacity-demand-analysis-only",
  creatorFacing:false,
  readOnly:true,
};
function admittedCapacity(){
  return admitRuntimeSpecialist({
    trustedRuntimeIdentity:"capacity-demand",
    claimedAgentIdentity:"capacity-demand",
    manifest:capacityManifest,
    manifestSourcePath:CAPACITY_PATH,
  });
}
function boundCapacity(){
  const admission=admittedCapacity();
  assert.equal(admission.admitted,true);
  const bound=bindContributionToAdmission({
    agentId:"capacity-demand",
    authority:capacityManifest.authority,
    creatorFacing:false,
    readOnly:true,
    summary:"capacity evidence",
  },admission.admissionEvidence);
  assert.equal(bound.valid,true);
  return bound.contribution;
}

test("Supervisor rejects duplicate specialist contribution amplification",()=>{
  const contribution=boundCapacity();
  const workOrder=createOperationsSupervisorWorkOrder({specialistContributions:[contribution,contribution]});
  const result=validateOperationsSupervisorWorkOrder(workOrder);
  assert.equal(result.valid,false);
  assert.ok(result.issues.includes("duplicate_specialist_contribution:capacity-demand"));
});

test("Supervisor rejects admission evidence with wrong canonical manifest path",()=>{
  const contribution=boundCapacity();
  contribution.runtimeAdmission.manifestSourcePath="ai/ForgedAgent.js";
  const result=validateOperationsSupervisorWorkOrder(createOperationsSupervisorWorkOrder({specialistContributions:[contribution]}));
  assert.equal(result.valid,false);
  assert.ok(result.issues.includes("runtime_admission_manifest_source_path_mismatch"));
});

test("begin-recovery cannot drift from the authorised recovery request",async()=>{
  const approvedContext={recoveryRequestId:"r1",actionId:"restore-known-good",targetScope:{service:"movie-mentor",region:"eu"}};
  const authorised=await evaluateOperationsTransition(
    createOperationsState({state:"awaiting-recovery-authorisation",incidentId:"i1"}),
    "authorise-recovery",
    {evidence:["diagnosis"],transitionContext:approvedContext,verifyTransitionAuthorisation:authoriser},
  );
  assert.equal(authorised.permitted,true);
  const drift=await evaluateOperationsTransition(authorised,"begin-recovery",{
    evidence:["start"],
    transitionContext:{...approvedContext,targetScope:{service:"movie-mentor",region:"us"}},
    verifyTransitionAuthorisation:authoriser,
  });
  assert.equal(drift.permitted,false);
  assert.equal(drift.reason,"transition_context_drift");
  assert.ok(drift.issues.includes("recovery_scope_context_drift"));
});

test("begin-recovery accepts the exact authorised request action and scope",async()=>{
  const context={recoveryRequestId:"r1",actionId:"restore-known-good",targetScope:{region:"eu",service:"movie-mentor"}};
  const authorised=await evaluateOperationsTransition(createOperationsState({state:"awaiting-recovery-authorisation",incidentId:"i1"}),"authorise-recovery",{evidence:["diagnosis"],transitionContext:context,verifyTransitionAuthorisation:authoriser});
  const started=await evaluateOperationsTransition(authorised,"begin-recovery",{evidence:["start"],transitionContext:{recoveryRequestId:"r1",actionId:"restore-known-good",targetScope:{service:"movie-mentor",region:"eu"}},verifyTransitionAuthorisation:authoriser});
  assert.equal(started.permitted,true);
  assert.equal(started.state,"recovering");
});

test("begin-rollback cannot drift from the authorised rollback request",async()=>{
  const context={rollbackRequestId:"rb1",actionId:"restore-previous-release",targetScope:{service:"movie-mentor",region:"eu"}};
  const authorised=await evaluateOperationsTransition(createOperationsState({state:"awaiting-rollback-authorisation",incidentId:"i1"}),"authorise-rollback",{evidence:["verification requires rollback"],transitionContext:context,verifyTransitionAuthorisation:authoriser});
  assert.equal(authorised.permitted,true);
  const drift=await evaluateOperationsTransition(authorised,"begin-rollback",{evidence:["begin rollback"],transitionContext:{...context,actionId:"different-action"},verifyTransitionAuthorisation:authoriser});
  assert.equal(drift.permitted,false);
  assert.equal(drift.reason,"transition_context_drift");
  assert.ok(drift.issues.includes("rollback_action_context_drift"));
});

test("verification-passed requires positive correlated verification context",async()=>{
  const state=createOperationsState({state:"verifying-recovery",incidentId:"i1"});
  const missing=await evaluateOperationsTransition(state,"verification-passed",{evidence:["looks healthy"]});
  assert.equal(missing.permitted,false);
  assert.equal(missing.reason,"transition_context_invalid");
  const passed=await evaluateOperationsTransition(state,"verification-passed",{
    evidence:["independent verification"],
    transitionContext:{
      verificationKind:"recovery",
      verificationReference:"verify-1",
      executionId:"rex-1",
      correlationId:"corr-1",
      verificationWindowId:"window-1",
      verificationPassed:true,
    },
  });
  assert.equal(passed.permitted,true);
  assert.equal(passed.state,"recovered");
});

test("rollback verification cannot masquerade as recovery verification",async()=>{
  const state=createOperationsState({state:"verifying-recovery",incidentId:"i1"});
  const result=await evaluateOperationsTransition(state,"verification-passed",{
    evidence:["evidence"],
    transitionContext:{verificationKind:"rollback",verificationReference:"v1",executionId:"x1",correlationId:"c1",verificationWindowId:"w1",verificationPassed:true},
  });
  assert.equal(result.permitted,false);
  assert.ok(result.issues.includes("recovery_verification_kind_required"));
});

test("quarantine release request cannot target a different agent",async()=>{
  const quarantined=createOperationsState({state:"quarantined",incidentId:"i1",transitionContext:{targetAgentRuntimeIdentity:"capacity-demand"}});
  const result=await evaluateOperationsTransition(quarantined,"request-quarantine-release",{
    evidence:["repair evidence available"],
    transitionContext:{targetAgentRuntimeIdentity:"queue-job-health",quarantineReference:"q1"},
  });
  assert.equal(result.permitted,false);
  assert.equal(result.reason,"transition_context_drift");
});

test("release-quarantine must match the release request reference",async()=>{
  const quarantined=createOperationsState({state:"quarantined",incidentId:"i1",transitionContext:{targetAgentRuntimeIdentity:"capacity-demand"}});
  const requested=await evaluateOperationsTransition(quarantined,"request-quarantine-release",{
    evidence:["repair evidence available"],
    transitionContext:{targetAgentRuntimeIdentity:"capacity-demand",quarantineReference:"q1"},
  });
  assert.equal(requested.permitted,true);
  const wrong=await evaluateOperationsTransition(requested,"release-quarantine",{
    evidence:["release authorised"],
    transitionContext:{targetAgentRuntimeIdentity:"capacity-demand",quarantineReference:"q2"},
    verifyTransitionAuthorisation:authoriser,
  });
  assert.equal(wrong.permitted,false);
  assert.ok(wrong.issues.includes("quarantine_release_reference_context_drift"));
  const correct=await evaluateOperationsTransition(requested,"release-quarantine",{
    evidence:["release authorised"],
    transitionContext:{targetAgentRuntimeIdentity:"capacity-demand",quarantineReference:"q1"},
    verifyTransitionAuthorisation:authoriser,
  });
  assert.equal(correct.permitted,true);
  assert.equal(correct.state,"diagnosing");
});

test("recovery executor request must match authorised state-machine context",async()=>{
  const context={recoveryRequestId:"r1",actionId:"safe-recovery",targetScope:{service:"movie-mentor",region:"eu"}};
  const state=await evaluateOperationsTransition(createOperationsState({state:"awaiting-recovery-authorisation",incidentId:"i1"}),"authorise-recovery",{evidence:["diagnosis"],transitionContext:context,verifyTransitionAuthorisation:authoriser});
  const request=createControlledRecoveryRequest({requestId:"r1",actionId:"safe-recovery",targetScope:{region:"eu",service:"movie-mentor"},requestedBy:"ops",idempotencyKey:"k1"});
  assert.equal(validateRecoveryExecutionAgainstState({currentState:state,incidentId:"i1",request}).valid,true);
  const drift={...request,actionId:"different-action"};
  const blocked=validateRecoveryExecutionAgainstState({currentState:state,incidentId:"i1",request:drift});
  assert.equal(blocked.valid,false);
  assert.ok(blocked.issues.includes("recovery_action_context_mismatch"));
});

test("rollback executor request must match authorised state-machine context",async()=>{
  const context={rollbackRequestId:"rb1",actionId:"safe-rollback",targetScope:{service:"movie-mentor",region:"eu"}};
  const state=await evaluateOperationsTransition(createOperationsState({state:"awaiting-rollback-authorisation",incidentId:"i1"}),"authorise-rollback",{evidence:["rollback required"],transitionContext:context,verifyTransitionAuthorisation:authoriser});
  const request=createControlledRollbackRequest({requestId:"rb1",actionId:"safe-rollback",scope:{region:"eu",service:"movie-mentor"},requestedBy:"ops"});
  assert.equal(validateRollbackExecutionAgainstState({currentState:state,incidentId:"i1",request}).valid,true);
  const blocked=validateRollbackExecutionAgainstState({currentState:state,incidentId:"different-incident",request});
  assert.equal(blocked.valid,false);
  assert.ok(blocked.issues.includes("rollback_incident_context_mismatch"));
});

let failed=0;
for(const [name,fn] of tests){
  try{await fn();console.log(`PASS ${name}`)}
  catch(error){failed++;console.error(`FAIL ${name}`);console.error(error)}
}
if(failed){console.error(`\nWarp 40 Operations seam verification failed: ${failed}/${tests.length}`);process.exit(1)}
console.log(`\nWarp 40 Operations seam verification passed: ${tests.length}/${tests.length}`);
