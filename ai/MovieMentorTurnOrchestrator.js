import { interpretMovieMentorSemantics } from "./MovieMentorSemanticInterpreter.js";
import { executeMovieMentorSpecialistPlan } from "./MovieMentorSpecialistExecutor.js";
import { synthesizeMovieMentorResponse } from "./MovieMentorSynthesisEngine.js";
import { verifyAuthoritativeTurnContext } from "./MovieMentorTurnContextControl.js";

const MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION = "1.1.0";
const MOVIE_MENTOR_TURN_CONTRACT_VERSION = "1.1.0";
const LIVE_SPECIALIST_ORDER = Object.freeze(["story", "character"]);

function cleanString(value){return typeof value === "string" ? value.trim() : "";}
function asArray(value){return Array.isArray(value) ? value : [];}
function clone(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value));}catch{return value;}}
function creatorMessageFrom(input){return cleanString(input?.input?.message || input?.message || input?.context?.activeIdea || input?.authoritativeTurnContext?.creatorMessage || input?.context?.authoritativeTurnContext?.creatorMessage || "");}
function materialClarifications(semantic){return asArray(semantic?.clarificationNeeded).filter(item=>item?.material!==false);}
function contextEnvelopeFrom(input){return input?.authoritativeTurnContext || input?.context?.authoritativeTurnContext || null;}
function contextForEngines(envelope,proof){return{projectId:envelope.projectId||null,creatorSessionId:envelope.creatorSessionId||null,creatorConfirmedContext:clone(envelope.creatorConfirmedContext||[]),projectJourney:clone(envelope.projectJourney||null),memoryContext:clone(envelope.memoryContext||null),responseBlueprint:clone(envelope.responseBlueprint||null),communicationPlan:clone(envelope.communicationPlan||null),turnContextAuthority:{snapshotFingerprint:proof.snapshotFingerprint,snapshotReference:proof.snapshotReference,revision:proof.revision,revisionAuthorityReference:proof.revisionAuthorityReference,creatorState:clone(proof.creatorState)}};}

function buildSpecialistPlan({creatorMessage,semanticIntelligence,creatorConfirmedContext,context={}}={}){
  const stageId=cleanString(semanticIntelligence?.recommendedStageId)||null;
  const taskId=cleanString(semanticIntelligence?.recommendedTaskId)||null;
  const projectJourney=clone(context?.projectJourney || null);
  return {
    version:MOVIE_MENTOR_TURN_CONTRACT_VERSION,
    authority:"mentor-orchestrated",
    turnContextAuthority:clone(context?.turnContextAuthority||null),
    workOrders:LIVE_SPECIALIST_ORDER.map(agentId=>({
      agentId,
      purpose:agentId==="story"?"Advise Mentor on story structure, dramatic direction and narrative possibilities grounded in the creator's current meaning.":"Advise Mentor on character goals, relationships, motivation and character-driven conflict grounded in the creator's current meaning.",
      creatorFacing:false,
      mayAdvanceJourney:false,
      mayOverwriteCreatorTruth:false,
      authority:"mentor-provisional",
      input:{creatorMessage,stageId,taskId,semanticIntelligence:clone(semanticIntelligence),creatorConfirmedContext:clone(creatorConfirmedContext),projectJourney,memoryContext:clone(context?.memoryContext||null),turnContextAuthority:clone(context?.turnContextAuthority||null)}
    }))
  };
}

function clarificationResponse({creatorMessage,semanticIntelligence,semanticResult,turnContextProof}={}){
  const first=materialClarifications(semanticIntelligence)[0];
  const question=cleanString(first?.question) || "Could you clarify what you mean before we continue?";
  return {
    success:true,status:"clarification-required",text:question,creatorMessage,semanticIntelligence:clone(semanticIntelligence),specialistPlan:null,specialistResult:null,synthesisResult:null,turnContextProof:clone(turnContextProof),mayAdvanceJourney:false,
    authority:{creatorTruthDominates:true,authoritativeTurnContextRequired:true,validatedSemanticsRequired:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,singleCreatorFacingMentor:true},
    metadata:{orchestratorVersion:MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,turnContractVersion:MOVIE_MENTOR_TURN_CONTRACT_VERSION,semanticMetadata:clone(semanticResult?.metadata||null)}
  };
}

async function orchestrateMovieMentorTurn(input={},deps={}){
  const creatorMessage=creatorMessageFrom(input);
  if(!creatorMessage){const error=new Error("A creator message is required for a Movie Mentor turn.");error.code="MOVIE_MENTOR_TURN_MESSAGE_REQUIRED";throw error;}
  const envelope=contextEnvelopeFrom(input);
  if(!envelope){const error=new Error("An authoritative creator/project turn context is required.");error.code="MOVIE_MENTOR_TURN_CONTEXT_REQUIRED";throw error;}
  if(cleanString(envelope.creatorMessage)!==creatorMessage){const error=new Error("Creator message does not match the authoritative turn context snapshot.");error.code="MOVIE_MENTOR_TURN_CONTEXT_MESSAGE_MISMATCH";throw error;}
  const verifyContext=deps.verifyTurnContext || verifyAuthoritativeTurnContext;
  const turnContextProof=await verifyContext(clone(envelope),{readAuthoritativeRevision:deps.readAuthoritativeRevision,readAuthoritativeCreatorState:deps.readAuthoritativeCreatorState});
  if(turnContextProof?.verified!==true){const error=new Error("Authoritative Movie Mentor turn context could not be verified.");error.code="MOVIE_MENTOR_TURN_CONTEXT_NOT_AUTHORITATIVE";error.validationIssues=asArray(turnContextProof?.reasons);throw error;}
  const frozenContext=contextForEngines(envelope,turnContextProof);
  const interpret=deps.interpretSemantics || interpretMovieMentorSemantics;
  const executeSpecialists=deps.executeSpecialistPlan || executeMovieMentorSpecialistPlan;
  const synthesize=deps.synthesizeResponse || synthesizeMovieMentorResponse;

  const semanticInput={message:creatorMessage,context:clone(frozenContext),options:clone(input?.options||{})};
  const semanticResult=await interpret(semanticInput);
  const semanticIntelligence=semanticResult?.structured?.movieJourneyIntelligence;
  if(!semanticIntelligence || typeof semanticIntelligence!=="object"){const error=new Error("Semantic Interpreter did not return the canonical Movie Journey intelligence contract.");error.code="MOVIE_MENTOR_TURN_SEMANTIC_CONTRACT_MISSING";throw error;}

  if(materialClarifications(semanticIntelligence).length || semanticIntelligence.readyToAdvance!==true)return clarificationResponse({creatorMessage,semanticIntelligence,semanticResult,turnContextProof});

  const creatorConfirmedContext=asArray(frozenContext.creatorConfirmedContext).map(clone);
  const specialistPlan=buildSpecialistPlan({creatorMessage,semanticIntelligence,creatorConfirmedContext,context:frozenContext});
  const specialistResult=await executeSpecialists(clone(specialistPlan));
  const contributions=asArray(specialistResult?.contributions).filter(item=>item&&typeof item==="object");

  const synthesisResult=await synthesize({
    creatorMessage,creatorConfirmedContext:clone(creatorConfirmedContext),semanticIntelligence:clone(semanticIntelligence),semanticMentorDraft:cleanString(semanticResult?.mentorDraft || semanticResult?.structured?.mentorDraft)||null,contributions:clone(contributions),responseBlueprint:clone(frozenContext.responseBlueprint),communicationPlan:clone(frozenContext.communicationPlan),memoryContext:clone(frozenContext.memoryContext),turnContextAuthority:clone(frozenContext.turnContextAuthority)
  });
  if(synthesisResult?.success!==true || !cleanString(synthesisResult?.text)){const error=new Error("Mentor Synthesis did not return a creator-facing response.");error.code="MOVIE_MENTOR_TURN_SYNTHESIS_CONTRACT_MISSING";throw error;}

  return {
    success:true,status:"mentor-response-ready",text:cleanString(synthesisResult.text),creatorMessage,semanticIntelligence:clone(semanticIntelligence),specialistPlan:clone(specialistPlan),specialistResult:clone(specialistResult),synthesisResult:clone(synthesisResult),turnContextProof:clone(turnContextProof),mayAdvanceJourney:false,
    authority:{creatorTruthDominates:true,authoritativeTurnContextRequired:true,validatedSemanticsOutrankSpecialists:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,specialistContentBecomesCanonicalTruth:false,singleCreatorFacingMentor:true},
    metadata:{orchestratorVersion:MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,turnContractVersion:MOVIE_MENTOR_TURN_CONTRACT_VERSION,semanticMetadata:clone(semanticResult?.metadata||null),specialistMetadata:clone(specialistResult?.metadata||null),synthesisMetadata:clone(synthesisResult?.metadata||null)}
  };
}

export {MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,MOVIE_MENTOR_TURN_CONTRACT_VERSION,LIVE_SPECIALIST_ORDER,buildSpecialistPlan,orchestrateMovieMentorTurn};
export default orchestrateMovieMentorTurn;
