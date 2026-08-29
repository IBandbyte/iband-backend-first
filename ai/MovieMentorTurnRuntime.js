import crypto from "node:crypto";
import { createTurnContextEnvelope } from "./MovieMentorTurnContextControl.js";
import { orchestrateMovieMentorTurn } from "./MovieMentorTurnOrchestrator.js";
import { interpretMovieMentorSemantics } from "./MovieMentorSemanticInterpreter.js";
import { executeMovieMentorSpecialistWorkOrder, LIVE_AGENT_IDS, MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION, SPECIALIST_CONTRACT_VERSION } from "./MovieMentorSpecialistExecutor.js";
import { synthesizeMovieMentorResponse } from "./MovieMentorSynthesisEngine.js";
import { buildCurrentCreatorTruthView } from "./MovieMentorCreatorTruthViewControl.js";
import { readAuthoritativeTurnSource, readAuthoritativeRevision, readAuthoritativeCreatorState } from "./MovieMentorCreatorStateStore.js";

const MOVIE_MENTOR_TURN_RUNTIME_VERSION = "1.5.0";
function s(v){return typeof v==="string"?v.trim():"";}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function messageFrom(input){return s(input?.input?.message||input?.message||"");}
function identityFrom(input){return{projectId:s(input?.projectId||input?.context?.projectId)||null,creatorSessionId:s(input?.creatorSessionId||input?.context?.creatorSessionId)||null};}
function runtimeError(code,message,extras={}){const e=new Error(message);e.code=code;Object.assign(e,extras);return e;}
function buildRequestDigest({creatorMessage,projectId,options}={}){return crypto.createHash("sha256").update(JSON.stringify({creatorMessage:s(creatorMessage),projectId:s(projectId),options:clone(options||{})})).digest("hex");}
function findProviderEvidence(value,seen=new Set()){if(!value||typeof value!=="object"||seen.has(value))return null;seen.add(value);const externalEffectId=s(value.responseId||value.providerResponseId||value.externalEffectId);if(externalEffectId)return{externalEffectId,provider:s(value.provider)||"unknown-provider"};for(const child of Object.values(value)){const found=findProviderEvidence(child,seen);if(found)return found;}return null;}

function buildTurnEnvelopeFromDurableState({creatorMessage,state}={}){
 if(!s(creatorMessage))throw runtimeError("MOVIE_MENTOR_TURN_MESSAGE_REQUIRED","A creator message is required for a Movie Mentor turn.");
 if(!state||typeof state!=="object")throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_INVALID","Durable creator state is required to build a Movie Mentor turn.");
 const currentCreatorTruth=buildCurrentCreatorTruthView(state.creatorConfirmedContext||[]);
 return createTurnContextEnvelope({projectId:state.projectId||null,creatorSessionId:state.creatorSessionId||null,creatorMessage:s(creatorMessage),revision:{capturedRevision:state.revision,authoritativeRevision:state.revision,authorityReference:state.revisionAuthorityReference},creatorState:{generation:state.creatorStateGeneration,fingerprint:state.creatorStateFingerprint,authorityReference:state.creatorAuthorityReference},snapshotReference:state.snapshotReference,capturedAt:state.capturedAt,creatorConfirmedContext:clone(currentCreatorTruth),projectJourney:clone(state.projectJourney??null),memoryContext:clone(state.memoryContext??null),responseBlueprint:clone(state.responseBlueprint??null),communicationPlan:clone(state.communicationPlan??null)});
}

function createFencedInferenceOrchestrationDeps({execution,inferenceExecutionAuthority,deps={},onClaim=null}={}){
 if(execution?.authorized!==true||typeof inferenceExecutionAuthority?.claimProviderCall!=="function")throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_AUTHORITY_REQUIRED","Fenced orchestration requires authoritative durable inference execution.");
 const invoke=async(slotId,task,providerFunction)=>{
   const decision=await inferenceExecutionAuthority.claimProviderCall({execution,slotId,task});
   if(decision?.dispatchAuthorized!==true)throw runtimeError("MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_NOT_AUTHORIZED","Provider call was not admitted under the current durable execution lease.",{reason:decision?.reason||"provider-call-not-authorized",slotId});
   if(typeof onClaim==="function")onClaim(decision);
   if(typeof inferenceExecutionAuthority.beginProviderDispatch==="function"){
     const dispatch=await inferenceExecutionAuthority.beginProviderDispatch({providerCall:decision});
     if(dispatch?.dispatchAuthorized!==true)throw runtimeError("MOVIE_MENTOR_PROVIDER_EFFECT_DISPATCH_NOT_AUTHORIZED","Provider dispatch requires durable UNKNOWN effect reality.",{reason:dispatch?.reason||"provider-effect-unknown-not-durable",providerCallId:decision.providerCallId});
   }
   try{
     const result=await providerFunction();
     const evidence=findProviderEvidence(result);
     if(evidence&&typeof inferenceExecutionAuthority.contributeProviderEffectEvidence==="function")await inferenceExecutionAuthority.contributeProviderEffectEvidence({providerCallId:decision.providerCallId,...evidence,source:"provider-response"});
     return result;
   }catch(error){
     const evidence=findProviderEvidence(error?.providerEffectEvidence||null);
     if(evidence&&typeof inferenceExecutionAuthority.contributeProviderEffectEvidence==="function")await inferenceExecutionAuthority.contributeProviderEffectEvidence({providerCallId:decision.providerCallId,...evidence,source:"provider-error-evidence"});
     throw error;
   }
 };
 const interpret=deps.interpretSemantics||interpretMovieMentorSemantics;
 const synthesize=deps.synthesizeResponse||synthesizeMovieMentorResponse;
 const executeWorkOrder=deps.executeSpecialistWorkOrder||executeMovieMentorSpecialistWorkOrder;
 return Object.freeze({
   async interpretSemantics(input){return invoke("semantic","movie-mentor-semantic",()=>interpret(input));},
   async executeSpecialistPlan(plan={}){
     const contributions=[],skipped=[],failures=[],metadata=[];
     for(const workOrder of Array.isArray(plan?.workOrders)?plan.workOrders:[]){
       const agentId=s(workOrder?.agentId);
       if(!LIVE_AGENT_IDS.has(agentId)){skipped.push({agentId:agentId||null,reason:"agent-not-live-yet"});continue;}
       try{
         const result=await invoke(agentId,`movie-mentor-specialist:${agentId}`,()=>executeWorkOrder(clone(workOrder),deps.specialistDeps||{}));
         contributions.push(result.contribution);
         metadata.push({agentId,metadata:clone(result.metadata||null)});
       }catch(error){
         failures.push({agentId:agentId||null,code:error?.code||"SPECIALIST_EXECUTION_FAILED",message:error instanceof Error?error.message:"Specialist execution failed.",validationIssues:Array.isArray(error?.validationIssues)?error.validationIssues:[]});
       }
     }
     return {version:MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,contractVersion:SPECIALIST_CONTRACT_VERSION,status:failures.length?"partial":"completed",contributions,skipped,failures,metadata,authority:{providerCallsRequireDurableExecutionClaim:true,providerDispatchRequiresDurableUnknown:true,creatorTruthDominates:true,specialistsRemainProvisional:true},liveAgents:[...LIVE_AGENT_IDS]};
   },
   async synthesizeResponse(input){return invoke("synthesis","movie-mentor-synthesis",()=>synthesize(input));},
 });
}

async function openLiveExecution({input,creatorMessage,durableProjectId,reservation,serverAuthority,inferenceExecutionAuthority,deps}={}){
 const creatorTurnId=s(input?.creatorTurnId);
 if(!creatorTurnId)throw runtimeError("MOVIE_MENTOR_CREATOR_TURN_ID_REQUIRED","Live paid inference requires a stable creatorTurnId supplied before the first transport attempt.");
 const ownerId=s(deps.createExecutionOwnerId?.())||`turn-owner-${crypto.randomUUID()}`;
 const requestDigest=buildRequestDigest({creatorMessage,projectId:durableProjectId,options:input?.options||{}});
 const opened=await inferenceExecutionAuthority.openExecution({creatorTurnId,principalId:s(serverAuthority?.principalId),projectId:durableProjectId,reservationId:s(reservation?.reservationId),requestDigest,ownerId});
 if(opened?.authorized!==true)throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_OPEN_DENIED","Durable inference execution could not be opened.");
 if(s(opened.ownerId)===ownerId){const current=await inferenceExecutionAuthority.assertFence(opened);if(current?.authorized!==true)throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_LEASE_NOT_AUTHORIZED","New inference execution does not hold a current durable lease.");return current;}
 const acquired=await inferenceExecutionAuthority.acquireExecution({executionId:opened.executionId,ownerId});
 if(acquired?.authorized!==true)throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_LEASE_NOT_AUTHORIZED","Inference execution lease is not currently owned by this turn attempt.",{reason:acquired?.reason||"lease-not-authorized"});
 return acquired;
}

async function runMovieMentorTurn(input={},deps={}){
 const creatorMessage=messageFrom(input);if(!creatorMessage)throw runtimeError("MOVIE_MENTOR_TURN_MESSAGE_REQUIRED","A creator message is required for a Movie Mentor turn.");
 const identity=identityFrom(input);if(!identity.projectId&&!identity.creatorSessionId)throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED","projectId or creatorSessionId is required for a durable Movie Mentor turn.");
 const readSource=deps.readAuthoritativeTurnSource||readAuthoritativeTurnSource,revisionReader=deps.readAuthoritativeRevision||readAuthoritativeRevision,stateReader=deps.readAuthoritativeCreatorState||readAuthoritativeCreatorState,orchestrate=deps.orchestrateTurn||orchestrateMovieMentorTurn,spendAuthority=deps.inferenceSpendAuthority,inferenceExecutionAuthority=deps.inferenceExecutionAuthority;
 if(typeof spendAuthority?.reserveTurn!=="function"||typeof spendAuthority?.settleTurn!=="function")throw runtimeError("MOVIE_MENTOR_INFERENCE_SPEND_AUTHORITY_REQUIRED","Movie Mentor turn runtime requires inference spend reservation and settlement authority.");
 const executionEnabled=typeof inferenceExecutionAuthority?.openExecution==="function"&&typeof inferenceExecutionAuthority?.claimProviderCall==="function";
 const state=await readSource(identity),envelope=buildTurnEnvelopeFromDurableState({creatorMessage,state}),durableProjectId=s(state?.projectId||envelope?.projectId);
 const reservation=await spendAuthority.reserveTurn({serverAuthority:deps.serverAuthority,projectId:durableProjectId});if(reservation?.authorized!==true)throw runtimeError("MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID","Movie Mentor inference spend reservation was not authoritative.");
 let execution=null,claimedCount=0,orchestrationDeps={readAuthoritativeRevision:revisionReader,readAuthoritativeCreatorState:stateReader};
 if(executionEnabled){execution=await openLiveExecution({input,creatorMessage,durableProjectId,reservation,serverAuthority:deps.serverAuthority,inferenceExecutionAuthority,deps});const fenced=createFencedInferenceOrchestrationDeps({execution,inferenceExecutionAuthority,deps,onClaim:()=>{claimedCount+=1;}});orchestrationDeps={...orchestrationDeps,...fenced,verifyTurnContext:deps.verifyTurnContext,resolveContinuationReferences:deps.resolveContinuationReferences,commitCreatorDecision:deps.commitCreatorDecision,readAuthoritativeTurnSource:deps.readAuthoritativeTurnSource,applyMovieMentorCreatorStateTransition:deps.applyMovieMentorCreatorStateTransition,writeAuthoritativeCreatorState:deps.writeAuthoritativeCreatorState};}
 let result;
 try{result=await orchestrate({message:creatorMessage,authoritativeTurnContext:envelope,options:clone(input?.options||{})},orchestrationDeps);}catch(error){if(executionEnabled&&claimedCount>0)throw runtimeError("MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED","Inference execution failed after one or more durable provider-call claims; spend remains reserved for reconciliation.",{cause:error,retryable:true,executionId:execution?.executionId||null,providerCallsClaimed:claimedCount});try{await spendAuthority.settleTurn({reservation,outcome:"released",reason:"orchestration-failed-before-provider-claim"});}catch(settlementError){settlementError.cause=error;throw settlementError;}throw error;}
 const settlement=await spendAuthority.settleTurn({reservation,outcome:"consumed",reason:"orchestration-succeeded"});if(settlement?.settled!==true)throw runtimeError("MOVIE_MENTOR_INFERENCE_SPEND_SETTLEMENT_INVALID","Successful Movie Mentor turn requires durable consumed settlement.");
 return{...result,metadata:{...(result?.metadata||{}),inferenceSpend:{authorized:true,reservationId:reservation.reservationId,units:reservation.units,operation:reservation.operation,settlement:"consumed"},...(executionEnabled?{inferenceExecution:{executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,leaseGeneration:execution.leaseGeneration,providerCallsClaimed:claimedCount,liveLeaseEnforced:true,providerEffectUnknownBeforeDispatch:typeof inferenceExecutionAuthority.beginProviderDispatch==="function"}}:{})}};
}
export{MOVIE_MENTOR_TURN_RUNTIME_VERSION,buildRequestDigest,buildTurnEnvelopeFromDurableState,findProviderEvidence,createFencedInferenceOrchestrationDeps,openLiveExecution,runMovieMentorTurn};
export default runMovieMentorTurn;
