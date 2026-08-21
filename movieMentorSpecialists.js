import express from "express";
import { executeMovieMentorSpecialistPlan, MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION, SPECIALIST_CONTRACT_VERSION } from "./ai/MovieMentorSpecialistExecutor.js";
import { getStructuredAIProviderConfig, getStructuredAIProviderConfigurationIssues } from "./ai/StructuredAIProviderClient.js";

const router=express.Router();
const SPECIALIST_GATEWAY_VERSION="1.0.0";
function cleanString(value){return typeof value==="string"?value.trim():"";}
function safeProviderStatus(){const c=getStructuredAIProviderConfig();const issues=getStructuredAIProviderConfigurationIssues(c);return {configured:issues.length===0,readiness:issues.length===0?"ready":"configuration-required",configurationIssues:issues,providerName:c.provider||null,model:c.model||null,modelConfigured:Boolean(c.model),apiKeyConfigured:Boolean(c.key),baseUrlConfigured:Boolean(c.url),timeoutMs:c.timeoutMs};}
function statusForCode(code){if(code==="SPECIALIST_WORK_ORDER_INVALID")return 400;if(code==="AI_PROVIDER_NOT_CONFIGURED")return 503;if(code==="AI_PROVIDER_AUTHENTICATION_FAILED"||code==="AI_PROVIDER_INVALID_MODEL")return 502;if(code==="AI_PROVIDER_TIMEOUT")return 504;if(code==="AI_PROVIDER_RATE_LIMITED"||code==="AI_PROVIDER_UNAVAILABLE")return 503;if(code==="SPECIALIST_STRUCTURED_OUTPUT_INVALID"||code==="SPECIALIST_CONTRIBUTION_INVALID")return 422;return 502;}

router.get("/health",(req,res)=>res.json({success:true,service:"movie-mentor-specialist-gateway",version:SPECIALIST_GATEWAY_VERSION,executorVersion:MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,contractVersion:SPECIALIST_CONTRACT_VERSION,...safeProviderStatus(),liveAgents:["story","character"],extensionAgents:["scene","cinematography","continuity","sound-music","production"],authority:{creatorTruthDominates:true,specialistsAreMentorProvisional:true,specialistsMayAdvanceJourney:false,specialistsMaySpeakDirectlyToCreator:false,mentorMustSynthesize:true}}));

router.post("/execute",async(req,res)=>{
  const plan=req.body&&typeof req.body==="object"?req.body?.plan||req.body:{};
  if(!Array.isArray(plan?.workOrders))return res.status(400).json({success:false,code:"SPECIALIST_PLAN_REQUIRED",message:"A specialist agent plan with workOrders is required."});
  try{const result=await executeMovieMentorSpecialistPlan(plan);return res.json({success:true,...result,metadata:{specialistGatewayVersion:SPECIALIST_GATEWAY_VERSION,specialistExecutorVersion:MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,specialistContractVersion:SPECIALIST_CONTRACT_VERSION}});}catch(error){const code=cleanString(error?.code)||"SPECIALIST_EXECUTION_FAILED";return res.status(statusForCode(code)).json({success:false,code,message:error instanceof Error?error.message:"Specialist execution failed.",providerFailureCategory:cleanString(error?.providerFailureCategory)||null,retryable:error?.retryable===true,configurationIssues:Array.isArray(error?.configurationIssues)?error.configurationIssues:[],validationIssues:Array.isArray(error?.validationIssues)?error.validationIssues:[],authority:{creatorTruthDominates:true,specialistsAreMentorProvisional:true,specialistsMayAdvanceJourney:false,specialistsMaySpeakDirectlyToCreator:false}});}
});

export {SPECIALIST_GATEWAY_VERSION};
export default router;
