/**
 * Movie Mentor Operations Atomic Freshness Gate v1.0.0
 * ----------------------------------------------------
 * Deterministic bridge between replay/freshness evidence and the existing
 * atomic Operations state + incident-ledger commit boundary.
 *
 * STATUS:
 * - Standalone / dormant architecture only.
 * - NOT wired to production persistence.
 * - NOT an AI agent.
 * - Grants no operational authority.
 */
import { commitTransitionWithAudit } from "./MovieMentorOperationsControlPlane.js";
import { validateFreshnessToken } from "./MovieMentorOperationsReplayFreshnessControl.js";

const VERSION="1.0.0";
const CONTRACT_VERSION="1.0.0";
const GATE_ID="operations-atomic-freshness-gate";
const AUTHORITY="operations-atomic-freshness-gate-contract-only";

const FRESHNESS_REQUIRED_EVENTS=Object.freeze(new Set([
  "authorise-recovery",
  "begin-recovery",
  "authorise-rollback",
  "begin-rollback",
  "quarantine-agent",
  "release-quarantine",
  "verification-passed",
]));

function cleanString(v){return typeof v==="string"?v.trim():""}
function cloneValue(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v))}catch{return v}}

function deriveFreshnessExpectations({currentState,event,transitionContext={}}={}){
  const eventId=cleanString(event),incidentId=cleanString(currentState?.incidentId),sequence=currentState?.sequence;
  if(!FRESHNESS_REQUIRED_EVENTS.has(eventId))return{required:false,event:eventId,expectations:null};
  if(!incidentId||!Number.isInteger(sequence)||sequence<0)return{required:true,event:eventId,error:"valid_incident_state_required",expectations:null};
  let expectedKind="transition-authorisation",expectedSubjectId=null,expectedCorrelationId=null;
  if(eventId==="verification-passed"){
    expectedKind=currentState?.state==="verifying-recovery"?"recovery-verification":currentState?.state==="verifying-rollback"?"rollback-verification":null;
    expectedSubjectId=cleanString(transitionContext?.executionId);
    expectedCorrelationId=cleanString(transitionContext?.correlationId);
    if(!expectedKind)return{required:true,event:eventId,error:"verification_state_not_supported",expectations:null};
    if(!expectedSubjectId||!expectedCorrelationId)return{required:true,event:eventId,error:"verification_freshness_context_required",expectations:null};
  }else if(["authorise-recovery","begin-recovery"].includes(eventId)){
    const requestId=cleanString(transitionContext?.recoveryRequestId);
    if(!requestId)return{required:true,event:eventId,error:"recovery_request_id_required_for_freshness",expectations:null};
    expectedSubjectId=`${eventId}:${requestId}`;
  }else if(["authorise-rollback","begin-rollback"].includes(eventId)){
    const requestId=cleanString(transitionContext?.rollbackRequestId);
    if(!requestId)return{required:true,event:eventId,error:"rollback_request_id_required_for_freshness",expectations:null};
    expectedSubjectId=`${eventId}:${requestId}`;
  }else if(eventId==="quarantine-agent"){
    const target=cleanString(transitionContext?.targetAgentRuntimeIdentity);
    if(!target)return{required:true,event:eventId,error:"quarantine_target_required_for_freshness",expectations:null};
    expectedSubjectId=`quarantine-agent:${target}`;
  }else if(eventId==="release-quarantine"){
    const target=cleanString(transitionContext?.targetAgentRuntimeIdentity),reference=cleanString(transitionContext?.quarantineReference);
    if(!target||!reference)return{required:true,event:eventId,error:"quarantine_release_context_required_for_freshness",expectations:null};
    expectedKind="quarantine-release-authorisation";
    expectedSubjectId=`release-quarantine:${target}:${reference}`;
  }
  return{required:true,event:eventId,expectations:{expectedKind,expectedIncidentId:incidentId,expectedSubjectId,expectedCorrelationId:expectedCorrelationId||null,expectedStateSequence:sequence}};
}

async function commitFreshTransitionWithAudit({
  currentState,
  event,
  transitionOptions={},
  incidentLedger,
  actorRuntimeIdentity=null,
  summary=null,
  freshnessToken=null,
}={}, {
  atomicCommitWithFreshness=null,
  trustedNow=Date.now(),
  maxWindowMs,
  clockSkewMs,
}={}){
  const binding=deriveFreshnessExpectations({currentState,event,transitionContext:transitionOptions?.transitionContext||{}});
  if(binding.required!==true)return{committed:false,reason:"freshness_gate_not_required_for_event",event:binding.event};
  if(binding.error)return{committed:false,reason:binding.error,event:binding.event};
  if(!freshnessToken||typeof freshnessToken!=="object")return{committed:false,reason:"freshness_token_required",event:binding.event};
  if(typeof atomicCommitWithFreshness!=="function")return{committed:false,reason:"trusted_atomic_freshness_commit_required",event:binding.event};

  const validationOptions={...binding.expectations,now:trustedNow};
  if(Number.isFinite(maxWindowMs))validationOptions.maxWindowMs=maxWindowMs;
  if(Number.isFinite(clockSkewMs))validationOptions.clockSkewMs=clockSkewMs;
  const freshness=validateFreshnessToken(freshnessToken,validationOptions);
  if(!freshness.valid)return{committed:false,reason:"freshness_validation_failed",issues:freshness.issues,event:binding.event};

  let backendOutcome=null;
  const result=await commitTransitionWithAudit({
    currentState,
    event,
    transitionOptions,
    incidentLedger,
    actorRuntimeIdentity,
    summary,
  },{
    atomicCommit:async transaction=>{
      try{
        backendOutcome=await atomicCommitWithFreshness({
          ...cloneValue(transaction),
          freshness:{
            token:cloneValue(freshnessToken),
            expectations:cloneValue(binding.expectations),
            replayKey:freshness.replayKey,
            requireAtomicRevalidation:true,
            requireSingleUseConsumption:true,
          },
        });
      }catch(error){
        backendOutcome={committed:false,threw:true,reason:cleanString(error?.code)||"atomic_freshness_commit_threw"};
        return{committed:false,reason:backendOutcome.reason};
      }
      if(backendOutcome?.committed===true){
        const proofOk=backendOutcome?.freshnessValidatedAtCommit===true&&backendOutcome?.freshnessClaimed===true&&cleanString(backendOutcome?.reference)&&cleanString(backendOutcome?.freshnessClaimReference);
        if(!proofOk)return{committed:false,reason:"atomic_freshness_commit_proof_incomplete"};
        return{committed:true,reference:cleanString(backendOutcome.reference)};
      }
      return{committed:false,reason:cleanString(backendOutcome?.reason)||"atomic_freshness_commit_failed"};
    },
  });

  if(backendOutcome?.committed===true&&result.committed!==true){
    return{
      ...result,
      committed:false,
      indeterminate:true,
      reason:"atomic_freshness_commit_indeterminate",
      requiredAction:"human-review-and-authoritative-storage-reconciliation",
      backendReference:cleanString(backendOutcome?.reference)||null,
      freshnessClaimReference:cleanString(backendOutcome?.freshnessClaimReference)||null,
    };
  }
  if(result.committed!==true)return{...result,indeterminate:false};
  return{
    ...result,
    indeterminate:false,
    freshnessReplayKey:freshness.replayKey,
    freshnessClaimReference:cleanString(backendOutcome?.freshnessClaimReference)||null,
    atomicFreshnessCommitReference:cleanString(backendOutcome?.reference)||result.commitReference||null,
  };
}

function getOperationsAtomicFreshnessGateManifest(){return{
  id:GATE_ID,
  name:"Movie Mentor Operations Atomic Freshness Gate",
  version:VERSION,
  contractVersion:CONTRACT_VERSION,
  status:"standalone-dormant-not-wired",
  authority:AUTHORITY,
  deterministicControl:true,
  aiAgent:false,
  freshnessRequiredEvents:[...FRESHNESS_REQUIRED_EVENTS],
  requirements:[
    "freshness-revalidated-at-commit-using-trusted-clock",
    "single-use-consumption-in-same-storage-transaction-as-state-and-ledger-advance",
    "compare-and-swap-on-expected-state-sequence-and-ledger-head",
    "traceable-transaction-and-freshness-claim-references",
    "verification-freshness-bound-to-execution-correlation-and-state-sequence",
    "authorisation-freshness-bound-to-exact-request-target-and-state-sequence",
    "indeterminate-outcomes-escalate-to-human-review-and-storage-reconciliation",
  ],
  restrictions:[
    "cannot-claim-freshness-before-state-ledger-transaction",
    "cannot-advance-on-expired-future-mismatched-or-replayed-evidence",
    "cannot-treat-incomplete-atomic-proof-as-success",
    "cannot-hide-possible-commit-as-clean-failure",
    "no-live-persistence-clock-or-authorisation-adapters",
  ],
}}

export{
  VERSION as OPERATIONS_ATOMIC_FRESHNESS_GATE_VERSION,
  CONTRACT_VERSION as OPERATIONS_ATOMIC_FRESHNESS_GATE_CONTRACT_VERSION,
  GATE_ID as OPERATIONS_ATOMIC_FRESHNESS_GATE_ID,
  AUTHORITY as OPERATIONS_ATOMIC_FRESHNESS_GATE_AUTHORITY,
  FRESHNESS_REQUIRED_EVENTS,
  deriveFreshnessExpectations,
  commitFreshTransitionWithAudit,
  getOperationsAtomicFreshnessGateManifest,
};
export default commitFreshTransitionWithAudit;
