import { createMovieMentorInferenceExecutionMongoStore, getMovieMentorInferenceExecutionMongoStoreStatus } from "./MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "./MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderEffectMongoStore, getMovieMentorProviderEffectMongoStoreStatus } from "./MovieMentorProviderEffectMongoStore.js";
import { createMovieMentorProviderEffectAuthority } from "./MovieMentorProviderEffectAuthority.js";
import { createMovieMentorProviderOperationMongoStore, getMovieMentorProviderOperationMongoStoreStatus } from "./MovieMentorProviderOperationMongoStore.js";
import { createMovieMentorProviderOperationAuthority, createMovieMentorProviderOperationBoundaryAuthority } from "./MovieMentorProviderOperationAuthority.js";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "./MovieMentorProviderOutcomeRecoveryAuthority.js";
import { retrieveMovieMentorProviderResponse } from "./MovieMentorProviderRecoveryAdapter.js";
import { createMovieMentorInferenceExecutionClosureAuthority } from "./MovieMentorInferenceExecutionClosureAuthority.js";
import { createMovieMentorCanonicalResultMongoStore, getMovieMentorCanonicalResultMongoStoreStatus } from "./MovieMentorCanonicalResultMongoStore.js";
import { createMovieMentorCanonicalResultAuthority } from "./MovieMentorCanonicalResultAuthority.js";
import { createMovieMentorResultCandidateMongoStore, getMovieMentorResultCandidateMongoStoreStatus, MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_ATOMIC_FENCE } from "./MovieMentorResultCandidateMongoStore.js";

const VERSION="1.21.0";
const DOMAIN="iband.movie-mentor.production-inference-execution-composition";
const EXECUTION_CAS="reservation-binding-active-closure-frozen-universe-provider-reality-revision-finalized-result-binding-and-atomic-abort";
const EFFECT_SERIALIZATION="execution-providerEffectRealityRevision";
const OPERATION_RECOVERY_IDENTITY="provider-adapter-route-fingerprint-recovery-mode";
const RESULT_FINALIZATION="atomic-result-insert-plus-closed-to-finalized-execution-transition";
const RESULT_LINEAGE="revalidated-in-finalization-transaction";
const RESULT_FRESHNESS="exact-provider-effect-reality-revision";
const CANDIDATE_AUTHORITY="zero-until-current-creator-state-and-current-execution-atomic-fence-plus-closure-and-canonical-finalization";
const CANDIDATE_FENCE="shared-execution-write-barrier-before-closure";
const ownedCompositionProofs=new WeakMap();

function ownedStatus(store){
  if(typeof store?.getStatus!=="function")return null;
  try{const status=store.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}
}
function executionCapabilityProven(status){return status?.configured===true&&status?.durable===true&&status?.cas===EXECUTION_CAS;}
function effectCapabilityProven(status){return status?.configured===true&&status?.cas==="revision"&&status?.crossLedgerSerialization===EFFECT_SERIALIZATION;}
function operationCapabilityProven(status){return status?.configured===true&&status?.durable===true&&status?.immutableProviderTarget===true&&status?.immutableProviderModel===true&&status?.immutableReconstructionInput===true&&status?.reconstructionInputBoundBeforeUnknownCapable===true&&status?.recoveryIdentity===OPERATION_RECOVERY_IDENTITY;}
function resultCapabilityProven(status){return status?.configured===true&&status?.candidateLineage===RESULT_LINEAGE&&status?.resultFinalization===RESULT_FINALIZATION&&status?.finalizationFreshnessFence===RESULT_FRESHNESS;}
function candidateCapabilityProven(status){return status?.configured===true&&status?.authority===CANDIDATE_AUTHORITY&&status?.atomicFence===CANDIDATE_FENCE&&status?.creatorStateAtomicFence===MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_ATOMIC_FENCE&&status?.legacySchemaAuthority===false;}
function isMovieMentorProductionInferenceExecutionOwnerProof(composition,status){return Boolean(composition&&status&&ownedCompositionProofs.get(composition)===status&&composition.status===status&&typeof composition.getStatus==="function"&&composition.getStatus()===status);}
function rejected(reason,statuses={}){return Object.freeze({ready:false,reason,version:VERSION,authority:null,...statuses,status:null,getStatus:()=>null});}
function ownedComposition({reason,authority,storeStatus,effectStoreStatus=null,operationStoreStatus=null,resultStoreStatus=null,candidateStoreStatus=null,fullExecutionAuthority=false}){
  const status=Object.freeze({
    domain:DOMAIN,
    production:true,
    ready:true,
    fullExecutionAuthority:fullExecutionAuthority===true,
    durableStoreProvenanceRequired:true,
    providerEffectStoreProvenanceRequired:fullExecutionAuthority===true,
    providerOperationStoreProvenanceRequired:fullExecutionAuthority===true,
    providerOperationTargetImmutableBeforeUnknownRequired:fullExecutionAuthority===true,
    providerOperationModelImmutableBeforeUnknownRequired:fullExecutionAuthority===true,
    providerReconstructionInputImmutableBeforeUnknownRequired:fullExecutionAuthority===true,
    providerEffectEvidenceOperationBindingRequired:fullExecutionAuthority===true,
    providerOutcomeRecoveryAuthorityRequired:fullExecutionAuthority===true,
    providerOutcomeRecoveryCurrentExecutionAuthorityRequired:fullExecutionAuthority===true,
    providerOutcomeRecoveryNeverImpliesRedispatch:true,
    canonicalResultStoreProvenanceRequired:fullExecutionAuthority===true,
    resultCandidateStoreProvenanceRequired:fullExecutionAuthority===true,
    resultCandidateCurrentCreatorStateAtomicFenceRequired:fullExecutionAuthority===true,
    freshExecutionCreationAuthorityRequired:true,
    providerCallAdmissionCurrentOwnershipRequired:true,
    providerEffectUnknownCurrentOwnershipRequired:true,
    authority,
    storeStatus,
    effectStoreStatus,
    operationStoreStatus,
    resultStoreStatus,
    candidateStoreStatus,
    processLocalFallback:false,
  });
  const getStatus=()=>status;
  const composition=Object.freeze({ready:true,reason,version:VERSION,authority,storeStatus,effectStoreStatus,operationStoreStatus,resultStoreStatus,candidateStoreStatus,status,getStatus});
  ownedCompositionProofs.set(composition,status);
  return composition;
}

function createMovieMentorProductionInferenceExecutionComposition({store=null,effectStore=null,operationStore=null,resultStore=null,candidateStore=null}={}){
  if(store||effectStore||operationStore||resultStore||candidateStore){
    return rejected("inference-execution-external-store-provenance-not-owned",{
      storeStatus:ownedStatus(store),
      effectStoreStatus:ownedStatus(effectStore),
      operationStoreStatus:ownedStatus(operationStore),
      resultStoreStatus:ownedStatus(resultStore),
      candidateStoreStatus:ownedStatus(candidateStore),
    });
  }

  const status=getMovieMentorInferenceExecutionMongoStoreStatus();
  if(status?.configured!==true)return rejected("inference-execution-store-not-configured",{storeStatus:status});
  if(!executionCapabilityProven(status))return rejected("inference-execution-capability-not-proven",{storeStatus:status});

  try{
    const durableStore=createMovieMentorInferenceExecutionMongoStore();
    const leaseAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store:durableStore,requireCreationAuthority:true,requireProviderCallAuthority:true});

    const effectStatus=getMovieMentorProviderEffectMongoStoreStatus();
    if(effectStatus?.configured!==true)return rejected("provider-effect-store-not-configured",{storeStatus:status,effectStoreStatus:effectStatus});
    if(!effectCapabilityProven(effectStatus))return rejected("provider-effect-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus});

    const operationStatus=getMovieMentorProviderOperationMongoStoreStatus();
    if(operationStatus?.configured!==true)return rejected("provider-operation-store-not-configured",{storeStatus:status,effectStoreStatus:effectStatus,operationStoreStatus:operationStatus});
    if(!operationCapabilityProven(operationStatus))return rejected("provider-operation-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,operationStoreStatus:operationStatus});

    const durableEffectStore=createMovieMentorProviderEffectMongoStore();
    const providerEffectAuthority=createMovieMentorProviderEffectAuthority({
      store:durableEffectStore,
      requireUnknownAuthority:true,
      requireEvidenceOperationBinding:true,
    });
    const durableOperationStore=createMovieMentorProviderOperationMongoStore();
    const providerOperationAuthority=createMovieMentorProviderOperationAuthority({store:durableOperationStore});
    const providerBoundaryAuthority=createMovieMentorProviderOperationBoundaryAuthority({
      leaseAuthority,
      providerEffectAuthority,
      providerOperationAuthority,
    });
    const contributeProviderEffectEvidence=async(input={})=>{
      const operation=await providerOperationAuthority.readOperation(input.providerCallId);
      if(!operation){
        const error=new Error("Production provider-effect evidence requires its exact durable provider operation.");
        error.code="MOVIE_MENTOR_PROVIDER_EFFECT_OPERATION_BINDING_REQUIRED";
        throw error;
      }
      return providerEffectAuthority.contributeEvidence({...input,providerOperation:operation});
    };
    const providerOutcomeRecoveryAuthority=createMovieMentorProviderOutcomeRecoveryAuthority({
      readProviderOperation:providerOperationAuthority.readOperation,
      readProviderEffectReality:providerEffectAuthority.readReality,
      recoverProviderResponse:retrieveMovieMentorProviderResponse,
      requireRecoveryAuthority:true,
      assertCurrentRecoveryAuthority:async({operation,recoveryAuthority}={})=>{
        const current=await leaseAuthority.assertFence(recoveryAuthority);
        if(current?.authorized!==true||current?.executionAuthorized!==true){
          return Object.freeze({
            authorized:false,
            currentRecoveryAuthorityVerified:false,
            reason:current?.reason||"execution-recovery-fenced",
          });
        }
        if(current.executionId!==operation?.executionId){
          return Object.freeze({
            authorized:false,
            currentRecoveryAuthorityVerified:false,
            reason:"execution-recovery-binding-conflict",
          });
        }
        return Object.freeze({
          authorized:true,
          currentRecoveryAuthorityVerified:true,
          transition:"provider-outcome-recovery",
          executionId:current.executionId,
          providerCallId:operation.providerCallId,
          ownerId:current.ownerId,
          leaseGeneration:current.leaseGeneration,
          leaseReference:current.leaseReference,
          fencingToken:current.fencingToken,
        });
      },
    });
    const closureAuthority=createMovieMentorInferenceExecutionClosureAuthority({store:durableStore,effectStore:durableEffectStore});

    const resultStatus=getMovieMentorCanonicalResultMongoStoreStatus();
    const candidateStatus=getMovieMentorResultCandidateMongoStoreStatus();
    if(resultStatus?.configured!==true)return rejected("canonical-result-store-not-configured",{storeStatus:status,effectStoreStatus:effectStatus,operationStoreStatus:operationStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if(candidateStatus?.configured!==true)return rejected("result-candidate-store-not-configured",{storeStatus:status,effectStoreStatus:effectStatus,operationStoreStatus:operationStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if(!resultCapabilityProven(resultStatus))return rejected("canonical-result-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,operationStoreStatus:operationStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if(!candidateCapabilityProven(candidateStatus))return rejected("result-candidate-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,operationStoreStatus:operationStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});

    const closureCapabilities={
      beginExecutionClosing:closureAuthority.beginClosing,
      recoverExpiredExecutionIntoClosing:closureAuthority.recoverExpiredIntoClosing,
      reconcileExecutionClosure:closureAuthority.reconcile,
      assertCurrentExecutionClosure:closureAuthority.assertCurrentClosure,
    };

    const durableResultStore=createMovieMentorCanonicalResultMongoStore();
    const durableCandidateStore=createMovieMentorResultCandidateMongoStore();
    const resultAuthority=createMovieMentorCanonicalResultAuthority({
      store:durableResultStore,
      assertCurrentClosure:closureAuthority.assertCurrentClosure,
      readResultCandidate:durableCandidateStore.readByExecution,
    });
    const stageResultCandidate=async({execution=null,resultPayload=null,creatorStateConsumptionProof=null}={})=>{
      const currentExecution=await leaseAuthority.assertFence(execution);
      if(currentExecution?.authorized!==true||currentExecution?.executionAuthorized!==true){
        return Object.freeze({authorized:false,staged:false,reason:currentExecution?.reason||"execution-forward-authority-required"});
      }
      return durableCandidateStore.stageCandidate({execution:currentExecution,resultPayload,creatorStateConsumptionProof});
    };
    const authority=Object.freeze({
      ...leaseAuthority,
      bindProviderReconstructionInput:providerOperationAuthority.bindReconstructionInput,
      beginProviderDispatch:providerBoundaryAuthority.beginProviderDispatch,
      assertProviderDispatch:providerBoundaryAuthority.assertProviderDispatch,
      contributeProviderEffectEvidence,
      readProviderEffectReality:providerEffectAuthority.readReality,
      readProviderOperation:providerOperationAuthority.readOperation,
      recoverProviderOutcome:providerOutcomeRecoveryAuthority.reconcile,
      ...closureCapabilities,
      stageResultCandidate,
      readResultCandidate:durableCandidateStore.readByExecution,
      commitCanonicalResult:resultAuthority.commitResult,
      readCanonicalResult:resultAuthority.readResult,
    });
    return ownedComposition({
      reason:"durable-inference-execution-provider-operation-target-model-reconstruction-input-provider-effect-evidence-operation-binding-current-lease-provider-outcome-recovery-provider-effect-closure-atomic-finalized-result-candidate-lineage-current-creator-state-atomic-fence-current-reality-and-result-authority-composed",
      authority,
      storeStatus:status,
      effectStoreStatus:effectStatus,
      operationStoreStatus:operationStatus,
      resultStoreStatus:resultStatus,
      candidateStoreStatus:candidateStatus,
      fullExecutionAuthority:true,
    });
  }catch(error){
    return rejected(error?.code||"inference-execution-composition-failed",{storeStatus:status});
  }
}

export{
  VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_EXECUTION_COMPOSITION_VERSION,
  DOMAIN as MOVIE_MENTOR_PRODUCTION_INFERENCE_EXECUTION_COMPOSITION_DOMAIN,
  createMovieMentorProductionInferenceExecutionComposition,
  isMovieMentorProductionInferenceExecutionOwnerProof,
};
export default createMovieMentorProductionInferenceExecutionComposition;
