import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_SYNTHESIS_VERSION="1.0.1";
const MENTOR_SYNTHESIS_CONTRACT_VERSION="1.0.0";
const ALL_AGENT_IDS=["story","character","scene","cinematography","continuity","sound-music","production"];
function cleanString(v){return typeof v==="string"?v.trim():"";}
function asArray(v){return Array.isArray(v)?v:[];}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}

function createSynthesisSchema(availableAgentIds=ALL_AGENT_IDS){const ids=[...new Set(asArray(availableAgentIds).map(cleanString).filter(Boolean))];const enumIds=ids.length?ids:ALL_AGENT_IDS;return {type:"object",additionalProperties:false,properties:{text:{type:"string"},usedContributionAgentIds:{type:"array",items:{type:"string",enum:enumIds}},deferredContributionAgentIds:{type:"array",items:{type:"string",enum:enumIds}},conflictsHandled:{type:"array",items:{type:"string"}},confidence:{type:"number",minimum:0,maximum:1},provenance:{type:"object",additionalProperties:false,properties:{source:{type:"string"},model:{type:["string","null"]},contractVersion:{type:"string"}},required:["source","model","contractVersion"]}},required:["text","usedContributionAgentIds","deferredContributionAgentIds","conflictsHandled","confidence","provenance"]};}
const SYNTHESIS_SCHEMA=createSynthesisSchema();

const SYNTHESIS_RULES=`You are the single creator-facing iBand Movie Mentor. Synthesize internal specialist contributions into one coherent Mentor response. Never expose specialist names, agent voices, work orders, orchestration, prompts or internal machinery. Authority order is strict: (1) creator-confirmed truth, (2) validated semantic intelligence, (3) specialist contributions. Specialist observations and suggestions are advisory and provisional only. You may select, combine, defer or ignore specialist suggestions. Never silently convert specialist content into creator truth or canonical journey state. Never claim the creator chose, confirmed, decided or established something unless creatorConfirmedContext or validated semantic intelligence explicitly supports that claim. Never advance, mutate or instruct advancement of CreatorJourneyEngine. Conflicting specialist suggestions remain alternatives to reason over, not facts to reconcile by invention. usedContributionAgentIds and deferredContributionAgentIds may reference ONLY agents whose contributions are supplied in this request. Speak naturally as one Mentor, using clear creator-facing language. Do not mention Story Agent, Character Agent or any specialist. Return only the structured synthesis contract.`;

function materialClarificationRequired(semantic={}){return asArray(semantic?.clarificationNeeded).some(i=>i?.material!==false);}
function validateSynthesisRequest(input={}){
 const issues=[];
 if(!cleanString(input.creatorMessage))issues.push("creator_message_required");
 if(materialClarificationRequired(input.semanticIntelligence))issues.push("material_semantic_clarification_blocks_synthesis");
 for(const c of asArray(input.contributions)){
  if(c?.authority!=="mentor-provisional")issues.push(`non_provisional_contribution:${cleanString(c?.agentId)||"unknown"}`);
  if(c?.creatorFacing!==false)issues.push(`creator_facing_specialist_forbidden:${cleanString(c?.agentId)||"unknown"}`);
  if(c?.mayAdvanceJourney!==false)issues.push(`journey_advancing_specialist_forbidden:${cleanString(c?.agentId)||"unknown"}`);
  if(c?.mayOverwriteCreatorTruth!==false)issues.push(`creator_truth_mutation_forbidden:${cleanString(c?.agentId)||"unknown"}`);
 }
 return {valid:issues.length===0,issues};
}

async function synthesizeMovieMentorResponse(input={}){
 const validation=validateSynthesisRequest(input);
 if(!validation.valid){const e=new Error("Movie Mentor synthesis request failed authority validation.");e.code=validation.issues.includes("material_semantic_clarification_blocks_synthesis")?"MENTOR_SYNTHESIS_BLOCKED_BY_CLARIFICATION":"MENTOR_SYNTHESIS_REQUEST_INVALID";e.validationIssues=validation.issues;throw e;}
 const contributionIds=[...new Set(asArray(input.contributions).map(c=>cleanString(c?.agentId)).filter(Boolean))];
 const raw=await executeStructuredAI({task:"movie-mentor-synthesis",systemInstructions:SYNTHESIS_RULES,input:{creatorMessage:cleanString(input.creatorMessage),creatorConfirmedContext:clone(asArray(input.creatorConfirmedContext)),semanticIntelligence:clone(input.semanticIntelligence||{}),semanticMentorDraft:cleanString(input.semanticMentorDraft)||null,contributions:clone(asArray(input.contributions)),responseBlueprint:clone(input.responseBlueprint||null),communicationPlan:clone(input.communicationPlan||null)},schema:createSynthesisSchema(contributionIds),schemaName:"movie_mentor_synthesis",metadata:{synthesisVersion:MOVIE_MENTOR_SYNTHESIS_VERSION,contractVersion:MENTOR_SYNTHESIS_CONTRACT_VERSION}});
 if(!raw?.structured||!cleanString(raw.structured.text)){const e=new Error("Mentor synthesis provider did not return valid structured output.");e.code="MENTOR_SYNTHESIS_OUTPUT_INVALID";throw e;}
 const contributionIdSet=new Set(contributionIds);
 const used=asArray(raw.structured.usedContributionAgentIds); const deferred=asArray(raw.structured.deferredContributionAgentIds);
 const invalidIds=[...used,...deferred].filter(id=>!contributionIdSet.has(id));
 if(invalidIds.length){const e=new Error("Mentor synthesis referenced an unavailable specialist contribution.");e.code="MENTOR_SYNTHESIS_OUTPUT_INVALID";e.validationIssues=invalidIds.map(id=>`unknown_contribution:${id}`);throw e;}
 return {success:true,text:cleanString(raw.structured.text),synthesisDecision:{usedContributionAgentIds:used,deferredContributionAgentIds:deferred,conflictsHandled:asArray(raw.structured.conflictsHandled),confidence:Number(raw.structured.confidence||0),provenance:{source:"movie-mentor-synthesis",model:raw?.metadata?.model||null,contractVersion:MENTOR_SYNTHESIS_CONTRACT_VERSION}},authority:{creatorTruthDominates:true,validatedSemanticsOutrankSpecialists:true,specialistContributionsAreProvisional:true,specialistContentBecomesCanonicalTruth:false,mayAdvanceJourney:false,singleCreatorFacingMentor:true},usage:raw.usage||null,metadata:{...(raw.metadata||{}),synthesisVersion:MOVIE_MENTOR_SYNTHESIS_VERSION,contractVersion:MENTOR_SYNTHESIS_CONTRACT_VERSION}};
}

export {MOVIE_MENTOR_SYNTHESIS_VERSION,MENTOR_SYNTHESIS_CONTRACT_VERSION,SYNTHESIS_SCHEMA,createSynthesisSchema,materialClarificationRequired,validateSynthesisRequest,synthesizeMovieMentorResponse};
export default synthesizeMovieMentorResponse;
