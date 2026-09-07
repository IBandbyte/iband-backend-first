import assert from "node:assert/strict";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { interpretMovieMentorSemantics } from "../ai/MovieMentorSemanticInterpreter.js";
import { executeMovieMentorSpecialistWorkOrder } from "../ai/MovieMentorSpecialistExecutor.js";
import { createContinuityWorkOrder, executeMovieMentorContinuityAgent } from "../ai/MovieMentorContinuityAgent.js";
import { synthesizeMovieMentorResponse } from "../ai/MovieMentorSynthesisEngine.js";
import { DERIVED_CONTINUITY_AUTHORITY } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";
const originalFetch=globalThis.fetch,envKeys=["IBAND_AI_PROVIDER","IBAND_AI_MODEL","IBAND_AI_BASE_URL","IBAND_AI_API_KEY","OPENAI_API_KEY"],originalEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
function restoreEnvironment(){for(const key of envKeys){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];}globalThis.fetch=originalFetch;}
function installOpenAIEnvironment(){process.env.IBAND_AI_PROVIDER="openai";process.env.IBAND_AI_MODEL="gpt-test";process.env.IBAND_AI_BASE_URL="https://provider.example.test/v1/responses";process.env.IBAND_AI_API_KEY="test-key";}
const validSemantic={understoodContext:[],provisionalContext:[],unresolvedContext:[],clarificationNeeded:[],readyToAdvance:true,recommendedStageId:null,recommendedTaskId:null,nextAction:null,resumeNote:null};
function response(id,structured){return new Response(JSON.stringify({id,model:"gpt-test",output_text:JSON.stringify(structured),usage:{total_tokens:1}}),{status:200,headers:{"Content-Type":"application/json"}});}
function idempotencyHeader(options={}){const headers=options?.headers||{};return headers["Idempotency-Key"]||headers["idempotency-key"]||null;}
async function captureSocket(structured,invoke,id){let header=null;globalThis.fetch=async(_url,options)=>{header=idempotencyHeader(options);return response(id,structured);};const result=await invoke();return{header,result};}
try{
 installOpenAIEnvironment();
 const operation=Object.freeze({providerOperationId:"provider-call-network-proof",executionId:"execution-network-proof",slotId:"semantic",task:"movie-mentor-semantic"});
 let malformedFetches=0;globalThis.fetch=async()=>{malformedFetches+=1;throw new Error("malformed provider operation must fail before network");};
 await assert.rejects(()=>executeStructuredAI({task:"movie-mentor-network-proof",systemInstructions:"Return the required schema.",input:{proof:true},schema:{type:"object",additionalProperties:false,properties:{value:{type:"string"}},required:["value"]},schemaName:"movie_mentor_network_operation_identity",providerOperation:{providerOperationId:"provider-call-network-proof",executionId:"execution-network-proof",slotId:"semantic"}}),error=>error?.code==="AI_PROVIDER_OPERATION_IDENTITY_INVALID");
 assert.equal(malformedFetches,0,"incomplete provider operation identity must fail closed before any provider socket opens");
 const shared=await captureSocket({value:"ok"},()=>executeStructuredAI({task:"movie-mentor-network-proof",systemInstructions:"Return the required schema.",input:{proof:true},schema:{type:"object",additionalProperties:false,properties:{value:{type:"string"}},required:["value"]},schemaName:"movie_mentor_network_operation_identity",providerOperation:operation}),"resp-shared-network-proof");
 assert.equal(shared.result.structured.value,"ok");assert.equal(shared.header,operation.providerOperationId,"the shared OpenAI socket must carry the exact durable Movie Mentor provider operation ID as the provider idempotency key");
 const semantic=await captureSocket(validSemantic,()=>interpretMovieMentorSemantics({message:"A lighthouse sends messages from a missing daughter.",context:{creatorConfirmedContext:[]}},{providerOperation:operation}),"resp-semantic-network-proof");
 assert.equal(semantic.result.structured.movieJourneyIntelligence.readyToAdvance,true);assert.equal(semantic.header,operation.providerOperationId,"the independent semantic OpenAI socket must carry the exact durable Movie Mentor provider operation ID as the provider idempotency key");
 const storyContribution={agentId:"story",observations:[],provisionalSuggestions:[],risksAndConflicts:[],creatorConfirmedDependencies:[],continuationObedienceClaims:[],confidence:1,provenance:{source:"test",model:null,contractVersion:"1.5.0"}};
 const storyWorkOrder={agentId:"story",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,authority:"mentor-provisional",purpose:"proof",input:{creatorMessage:"proof",creatorConfirmedContext:[],continuationObedienceEnvelope:{references:[],requiredReferenceIds:[]}}};
 const specialist=await captureSocket(storyContribution,()=>executeMovieMentorSpecialistWorkOrder(storyWorkOrder,{providerOperation:operation}),"resp-specialist-network-proof");
 assert.equal(specialist.result.success,true);assert.equal(specialist.header,operation.providerOperationId,"story/character specialist OpenAI sockets must carry exact durable provider operation identity");
 const continuityCandidate={agentId:"continuity",derivedConstraints:[],continuityConflicts:[],unresolvedContinuityQuestions:[],provisionalSuggestions:[],confidence:1,provenance:{source:"test",model:null,contractVersion:"2.1.1"}};
 const continuityWorkOrder=createContinuityWorkOrder({creatorMessage:"proof",semanticIntelligence:validSemantic,currentCreatorTruth:[]});
 const continuity=await captureSocket(continuityCandidate,()=>executeMovieMentorContinuityAgent(continuityWorkOrder,{providerOperation:operation}),"resp-continuity-network-proof");
 assert.equal(continuity.result.success,true);assert.equal(continuity.header,operation.providerOperationId,"continuity OpenAI socket must carry exact durable provider operation identity");
 const synthesisCandidate={text:"Proof response.",usedContributionAgentIds:[],deferredContributionAgentIds:[],continuationObedienceClaims:[],conflictsHandled:[],confidence:1,provenance:{source:"test",model:null,contractVersion:"1.3.0"}};
 const synthesisInput={creatorMessage:"proof",creatorConfirmedContext:[],semanticIntelligence:validSemantic,contributions:[],continuityConsequenceEnvelope:{status:"consistent",requiresClarification:false,authority:DERIVED_CONTINUITY_AUTHORITY,constraints:[]},continuationObedienceEnvelope:{references:[],requiredReferenceIds:[]}};
 const synthesis=await captureSocket(synthesisCandidate,()=>synthesizeMovieMentorResponse(synthesisInput,{providerOperation:operation}),"resp-synthesis-network-proof");
 assert.equal(synthesis.result.success,true);assert.equal(synthesis.header,operation.providerOperationId,"synthesis OpenAI socket must carry exact durable provider operation identity");
 let runtimeOperation=null;
 const providerCall=Object.freeze({authorized:true,dispatchAuthorized:true,projectId:"project-network-proof",principalId:"creator-network-proof",creatorTurnId:"turn-network-proof",reservationId:"reservation-network-proof",requestDigest:"request-network-proof",providerCallId:"provider-call-runtime-network-proof",executionId:"execution-runtime-network-proof",slotId:"semantic",task:"movie-mentor-semantic",ownerId:"worker-network-proof",leaseGeneration:1,leaseReference:"lease-network-proof",fencingToken:"fence-network-proof",admittedAt:"2031-01-01T00:00:00.000Z"});
 const runtimeAuthority={async claimProviderCall(){return providerCall;},async beginProviderDispatch(){return{authorized:true,dispatchAuthorized:true,effectState:"unknown"};},async assertProviderDispatch(){return{authorized:true,dispatchAuthorized:true};},async contributeProviderEffectEvidence(){return{accepted:true,state:"confirmed"};}};
 const fenced=createFencedInferenceOrchestrationDeps({execution:{authorized:true},inferenceExecutionAuthority:runtimeAuthority,deps:{interpretSemantics:async(_input,context={})=>{runtimeOperation=context.providerOperation||null;return{structured:{movieJourneyIntelligence:validSemantic},metadata:{provider:"openai",responseId:"resp-runtime-network-proof"}};}}});
 await fenced.interpretSemantics({proof:true});
 assert.deepEqual(runtimeOperation,{providerOperationId:providerCall.providerCallId,executionId:providerCall.executionId,slotId:providerCall.slotId,task:providerCall.task},"runtime must hand the exact durable provider-call identity across the provider invocation boundary rather than stopping one layer before the network client");
 console.log("✓ incomplete provider operation identity fails closed before the network boundary");
 console.log("✓ shared, semantic, specialist, continuity and synthesis OpenAI sockets carry exact durable Movie Mentor operation identity");
 console.log("✓ fenced runtime transports exact provider-call identity into the provider adapter boundary");
 console.log("LAW: AN INTERNAL IDEMPOTENCY ID THAT STOPS BEFORE THE NETWORK SOCKET IS NOT PROVIDER IDEMPOTENCY.");
 console.log("LAW: EVERY LIVE PROVIDER SOCKET MUST RECEIVE THE EXACT DURABLE OPERATION ID THAT EARNED DISPATCH AUTHORITY.");
 console.log("Movie Mentor provider operation network identity authority gate: GREEN");
}finally{restoreEnvironment();}