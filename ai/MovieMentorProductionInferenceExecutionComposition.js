import { createMovieMentorInferenceExecutionMongoStore, getMovieMentorInferenceExecutionMongoStoreStatus } from "./MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "./MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderEffectMongoStore, getMovieMentorProviderEffectMongoStoreStatus } from "./MovieMentorProviderEffectMongoStore.js";
import { createMovieMentorProviderEffectAuthority } from "./MovieMentorProviderEffectAuthority.js";
import { createMovieMentorInferenceExecutionClosureAuthority } from "./MovieMentorInferenceExecutionClosureAuthority.js";
import { createMovieMentorCanonicalResultMongoStore, getMovieMentorCanonicalResultMongoStoreStatus } from "./MovieMentorCanonicalResultMongoStore.js";
import { createMovieMentorCanonicalResultAuthority } from "./MovieMentorCanonicalResultAuthority.js";
import { createMovieMentorResultCandidateMongoStore, getMovieMentorResultCandidateMongoStoreStatus } from "./MovieMentorResultCandidateMongoStore.js";

const VERSION="1.10.0";
const DOMAIN="iband.movie-mentor.production-inference-execution-composition";
const EXECUTION_CAS="reservation-binding-active-closure-frozen-universe-provider-reality-revision-finalized-result-binding-and-atomic-abort";
const EFFECT_SERIALIZATION="execution-providerEffectRealityRevision";
const RESULT_FINALIZATION="atomic-result-insert-plus-closed-to-finalized-execution-transition";
const RESULT_LINEAGE="revalidated-in-finalization-transaction";
const RESULT_FRESHNESS="exact-provider-effect-reality-revision";
const CANDIDATE_AUTHORITY="zero-until-current-closure-and-canonical-finalization";
const CANDIDATE_FENCE="shared-execution-write-barrier-before-closure";
const ownedCompositionProofs=new WeakMap();

function ownedStatus(store){
  if(typeof store?.getStatus!=="function")return null;
  try{const status=store.getStatus();return status&&typeof status==="object"?status:null;}catch{return null;}
}
function executionCapabilityProven(status){return status?.configured===true&&status?.durable===true&&status?.cas===EXECUTION_CAS;}
function effectCapabilityProven(status){return status?.configured===true&&status?.cas==="revision"&&status?.crossLedgerSerialization===EFFECT_SERIALIZATION;}
function resultCapabilityProven(status){return status?.configured===true&&status?.candidateLineage===RESULT_LINEAGE&&status?.resultFinalization===RESULT_FINALIZATION&&status?.finalizationFreshnessFence===RESULT_FRESHNESS;}
function candidateCapabilityProven(status){return status?.configured===true&&status?.authority===CANDIDATE_AUTHORITY&&status?.atomicFence===CANDIDATE_FENCE;}
function isMovieMentorProductionInferenceExecutionOwnerProof(composition,status){return Boolean(composition&&status&&ownedCompositionProofs.get(composition)===status&&composition.status===status&&typeof composition.getStatus==="function"&&composition.getStatus()===status);}
function rejected(reason,statuses={}){return Object.freeze({ready:false,reason,version:VERSION,authority:null,...statuses,status:null,getStatus:()=>null});}
function ownedComposition({reason,authority,storeStatus,effectStoreStatus=null,resultStoreStatus=null,candidateStoreStatus=null,fullExecutionAuthority=false}){
  const status=Object.freeze({
    domain:DOMAIN,
    production:true,
    ready:true,
    fullExecutionAuthority:fullExecutionAuthority===true,
    durableStoreProvenanceRequired:true,
    providerEffectStoreProvenanceRequired:fullExecutionAuthority===true,
    canonicalResultStoreProvenanceRequired:fullExecutionAuthority===true,
    resultCandidateStoreProvenanceRequired:fullExecutionAuthority===true,
    authority,
    storeStatus,
    effectStoreStatus,
    resultStoreStatus,
    candidateStoreStatus,
    processLocalFallback:false,
  });
  const getStatus=()=>status;
  const composition=Object.freeze({ready:true,reason,version:VERSION,authority,storeStatus,effectStoreStatus,resultStoreStatus,candidateStoreStatus,status,getStatus});
  ownedCompositionProofs.set(composition,status);
  return composition;
}

function createMovieMentorProductionInferenceExecutionComposition({store=null,effectStore=null,resultStore=null,candidateStore=null}={}){
  const injectedStore=Boolean(store),status=injectedStore?ownedStatus(store):getMovieMentorInferenceExecutionMongoStoreStatus();
  if(injectedStore&&!executionCapabilityProven(status))return rejected("inference-execution-injected-capability-not-proven",{storeStatus:status});
  if(status?.configured!==true)return rejected("inference-execution-store-not-configured",{storeStatus:status});
  if(!executionCapabilityProven(status))return rejected("inference-execution-capability-not-proven",{storeStatus:status});
  try{
    const durableStore=store||createMovieMentorInferenceExecutionMongoStore();
    const leaseAuthority=createMovieMentorInferenceExecutionLeaseAuthority({store:durableStore});
    const injectedEffectStore=Boolean(effectStore),effectStatus=injectedEffectStore?ownedStatus(effectStore):getMovieMentorProviderEffectMongoStoreStatus();
    if(injectedEffectStore&&!effectCapabilityProven(effectStatus))return rejected("provider-effect-injected-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus});
    if(effectStatus?.configured!==true&&!store)return rejected("provider-effect-store-not-configured",{storeStatus:status,effectStoreStatus:effectStatus});
    if(effectStatus?.configured===true&&!effectCapabilityProven(effectStatus))return rejected("provider-effect-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus});
    if(effectStatus?.configured!==true)return ownedComposition({reason:"durable-inference-execution-authority-composed-without-injected-effect-store",authority:leaseAuthority,storeStatus:status,effectStoreStatus:effectStatus});

    const durableEffectStore=effectStore||createMovieMentorProviderEffectMongoStore();
    const providerEffectAuthority=createMovieMentorProviderEffectAuthority({store:durableEffectStore});
    const closureAuthority=createMovieMentorInferenceExecutionClosureAuthority({store:durableStore,effectStore:durableEffectStore});
    const injectedResultStore=Boolean(resultStore),resultStatus=injectedResultStore?ownedStatus(resultStore):getMovieMentorCanonicalResultMongoStoreStatus();
    const injectedCandidateStore=Boolean(candidateStore),candidateStatus=injectedCandidateStore?ownedStatus(candidateStore):getMovieMentorResultCandidateMongoStoreStatus();
    if(injectedResultStore&&!resultCapabilityProven(resultStatus))return rejected("canonical-result-injected-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if(injectedCandidateStore&&!candidateCapabilityProven(candidateStatus))return rejected("result-candidate-injected-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if(resultStatus?.configured===true&&!resultCapabilityProven(resultStatus))return rejected("canonical-result-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if(candidateStatus?.configured===true&&!candidateCapabilityProven(candidateStatus))return rejected("result-candidate-capability-not-proven",{storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    if((resultStatus?.configured!==true||candidateStatus?.configured!==true)&&!store)return rejected(resultStatus?.configured!==true?"canonical-result-store-not-configured":"result-candidate-store-not-configured",{storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});

    const closureCapabilities={beginExecutionClosing:closureAuthority.beginClosing,recoverExpiredExecutionIntoClosing:closureAuthority.recoverExpiredIntoClosing,reconcileExecutionClosure:closureAuthority.reconcile,assertCurrentExecutionClosure:closureAuthority.assertCurrentClosure};
    if(resultStatus?.configured!==true||candidateStatus?.configured!==true){
      const authority=Object.freeze({...leaseAuthority,beginProviderDispatch:providerEffectAuthority.beginDispatch,contributeProviderEffectEvidence:providerEffectAuthority.contributeEvidence,readProviderEffectReality:providerEffectAuthority.readReality,...closureCapabilities});
      return ownedComposition({reason:"durable-inference-execution-provider-effect-and-closure-authority-composed-without-injected-result-stores",authority,storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus});
    }

    const durableResultStore=resultStore||createMovieMentorCanonicalResultMongoStore(),durableCandidateStore=candidateStore||createMovieMentorResultCandidateMongoStore();
    const resultAuthority=createMovieMentorCanonicalResultAuthority({store:durableResultStore,assertCurrentClosure:closureAuthority.assertCurrentClosure,readResultCandidate:durableCandidateStore.readByExecution});
    const authority=Object.freeze({...leaseAuthority,beginProviderDispatch:providerEffectAuthority.beginDispatch,contributeProviderEffectEvidence:providerEffectAuthority.contributeEvidence,readProviderEffectReality:providerEffectAuthority.readReality,...closureCapabilities,stageResultCandidate:durableCandidateStore.stageCandidate,readResultCandidate:durableCandidateStore.readByExecution,commitCanonicalResult:resultAuthority.commitResult,readCanonicalResult:resultAuthority.readResult});
    return ownedComposition({reason:"durable-inference-execution-provider-effect-closure-atomic-finalized-result-candidate-lineage-current-reality-and-result-authority-composed",authority,storeStatus:status,effectStoreStatus:effectStatus,resultStoreStatus:resultStatus,candidateStoreStatus:candidateStatus,fullExecutionAuthority:true});
  }catch(error){return rejected(error?.code||"inference-execution-composition-failed",{storeStatus:status});}
}
export{VERSION as MOVIE_MENTOR_PRODUCTION_INFERENCE_EXECUTION_COMPOSITION_VERSION,DOMAIN as MOVIE_MENTOR_PRODUCTION_INFERENCE_EXECUTION_COMPOSITION_DOMAIN,createMovieMentorProductionInferenceExecutionComposition,isMovieMentorProductionInferenceExecutionOwnerProof};export default createMovieMentorProductionInferenceExecutionComposition;