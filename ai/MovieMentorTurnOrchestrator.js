import { interpretMovieMentorSemantics } from "./MovieMentorSemanticInterpreter.js";
import { executeMovieMentorSpecialistPlan } from "./MovieMentorSpecialistExecutor.js";
import { synthesizeMovieMentorResponse } from "./MovieMentorSynthesisEngine.js";

const MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION = "1.0.0";
const MOVIE_MENTOR_TURN_CONTRACT_VERSION = "1.0.0";
const LIVE_SPECIALIST_ORDER = Object.freeze(["story", "character"]);

function cleanString(value){return typeof value === "string" ? value.trim() : "";}
function asArray(value){return Array.isArray(value) ? value : [];}
function clone(value){if(value===undefined)return undefined;try{return JSON.parse(JSON.stringify(value));}catch{return value;}}
function creatorMessageFrom(input){return cleanString(input?.input?.message || input?.message || input?.context?.activeIdea || "");}
function creatorConfirmedContextFrom(input){return asArray(input?.context?.creatorConfirmedContext || input?.creatorConfirmedContext || input?.context?.confirmedMeaning || input?.context?.confirmedMeanings || []).map(clone);}
function materialClarifications(semantic){return asArray(semantic?.clarificationNeeded).filter(item=>item?.material!==false);}

function buildSpecialistPlan({creatorMessage,semanticIntelligence,creatorConfirmedContext,context={}}={}){
  const stageId=cleanString(semanticIntelligence?.recommendedStageId)||null;
  const taskId=cleanString(semanticIntelligence?.recommendedTaskId)||null;
  const projectJourney=clone(context?.projectJourney || context?.journey || null);
  return {
    version:MOVIE_MENTOR_TURN_CONTRACT_VERSION,
    authority:"mentor-orchestrated",
    workOrders:LIVE_SPECIALIST_ORDER.map(agentId=>({
      agentId,
      purpose:agentId==="story"?"Advise Mentor on story structure, dramatic direction and narrative possibilities grounded in the creator's current meaning.":"Advise Mentor on character goals, relationships, motivation and character-driven conflict grounded in the creator's current meaning.",
      creatorFacing:false,
      mayAdvanceJourney:false,
      mayOverwriteCreatorTruth:false,
      authority:"mentor-provisional",
      input:{creatorMessage,stageId,taskId,semanticIntelligence:clone(semanticIntelligence),creatorConfirmedContext:clone(creatorConfirmedContext),projectJourney}
    }))
  };
}

function clarificationResponse({creatorMessage,semanticIntelligence,semanticResult}={}){
  const material=materialClarifications(semanticIntelligence);
  const first=material[0];
  const question=cleanString(first?.question) || "Could you clarify what you mean before we continue?";
  return {
    success:true,
    status:"clarification-required",
    text:question,
    creatorMessage,
    semanticIntelligence:clone(semanticIntelligence),
    specialistPlan:null,
    specialistResult:null,
    synthesisResult:null,
    mayAdvanceJourney:false,
    authority:{creatorTruthDominates:true,validatedSemanticsRequired:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,singleCreatorFacingMentor:true},
    metadata:{orchestratorVersion:MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,turnContractVersion:MOVIE_MENTOR_TURN_CONTRACT_VERSION,semanticMetadata:clone(semanticResult?.metadata||null)}
  };
}

async function orchestrateMovieMentorTurn(input={},deps={}){
  const creatorMessage=creatorMessageFrom(input);
  if(!creatorMessage){const error=new Error("A creator message is required for a Movie Mentor turn.");error.code="MOVIE_MENTOR_TURN_MESSAGE_REQUIRED";throw error;}
  const interpret=deps.interpretSemantics || interpretMovieMentorSemantics;
  const executeSpecialists=deps.executeSpecialistPlan || executeMovieMentorSpecialistPlan;
  const synthesize=deps.synthesizeResponse || synthesizeMovieMentorResponse;

  const semanticResult=await interpret(clone(input));
  const semanticIntelligence=semanticResult?.structured?.movieJourneyIntelligence;
  if(!semanticIntelligence || typeof semanticIntelligence!=="object"){const error=new Error("Semantic Interpreter did not return the canonical Movie Journey intelligence contract.");error.code="MOVIE_MENTOR_TURN_SEMANTIC_CONTRACT_MISSING";throw error;}

  const material=materialClarifications(semanticIntelligence);
  if(material.length || semanticIntelligence.readyToAdvance!==true)return clarificationResponse({creatorMessage,semanticIntelligence,semanticResult});

  const creatorConfirmedContext=creatorConfirmedContextFrom(input);
  const specialistPlan=buildSpecialistPlan({creatorMessage,semanticIntelligence,creatorConfirmedContext,context:input?.context||{}});
  const specialistResult=await executeSpecialists(clone(specialistPlan));
  const contributions=asArray(specialistResult?.contributions).filter(item=>item&&typeof item==="object");

  const synthesisResult=await synthesize({
    creatorMessage,
    creatorConfirmedContext:clone(creatorConfirmedContext),
    semanticIntelligence:clone(semanticIntelligence),
    semanticMentorDraft:cleanString(semanticResult?.mentorDraft || semanticResult?.structured?.mentorDraft)||null,
    contributions:clone(contributions),
    responseBlueprint:clone(input?.responseBlueprint || input?.context?.responseBlueprint || null),
    communicationPlan:clone(input?.communicationPlan || input?.context?.communicationPlan || null)
  });
  if(synthesisResult?.success!==true || !cleanString(synthesisResult?.text)){const error=new Error("Mentor Synthesis did not return a creator-facing response.");error.code="MOVIE_MENTOR_TURN_SYNTHESIS_CONTRACT_MISSING";throw error;}

  return {
    success:true,
    status:"mentor-response-ready",
    text:cleanString(synthesisResult.text),
    creatorMessage,
    semanticIntelligence:clone(semanticIntelligence),
    specialistPlan:clone(specialistPlan),
    specialistResult:clone(specialistResult),
    synthesisResult:clone(synthesisResult),
    mayAdvanceJourney:false,
    authority:{creatorTruthDominates:true,validatedSemanticsOutrankSpecialists:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,specialistContentBecomesCanonicalTruth:false,singleCreatorFacingMentor:true},
    metadata:{orchestratorVersion:MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,turnContractVersion:MOVIE_MENTOR_TURN_CONTRACT_VERSION,semanticMetadata:clone(semanticResult?.metadata||null),specialistMetadata:clone(specialistResult?.metadata||null),synthesisMetadata:clone(synthesisResult?.metadata||null)}
  };
}

export {MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,MOVIE_MENTOR_TURN_CONTRACT_VERSION,LIVE_SPECIALIST_ORDER,buildSpecialistPlan,orchestrateMovieMentorTurn};
export default orchestrateMovieMentorTurn;
