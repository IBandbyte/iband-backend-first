import express from "express";
import { MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION, MOVIE_MENTOR_TURN_CONTRACT_VERSION } from "./ai/MovieMentorTurnOrchestrator.js";
import { runMovieMentorTurn, MOVIE_MENTOR_TURN_RUNTIME_VERSION } from "./ai/MovieMentorTurnRuntime.js";
import { getMovieMentorCreatorStateStoreStatus } from "./ai/MovieMentorCreatorStateStore.js";

const router=express.Router();
const MOVIE_MENTOR_TURN_GATEWAY_VERSION="1.1.0";
function cleanString(value){return typeof value==="string"?value.trim():"";}
function statusForCode(code){if(code==="MOVIE_MENTOR_TURN_MESSAGE_REQUIRED")return 400;if(code==="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND")return 404;if(code==="MOVIE_MENTOR_TURN_CONTEXT_NOT_AUTHORITATIVE"||code==="MOVIE_MENTOR_TURN_CONTEXT_MESSAGE_MISMATCH")return 409;if(code==="MOVIE_MENTOR_CREATOR_STATE_STORE_NOT_CONFIGURED"||code==="MOVIE_MENTOR_CREATOR_STATE_STORE_UNAVAILABLE")return 503;if(code==="MOVIE_MENTOR_TURN_SEMANTIC_CONTRACT_MISSING"||code==="MOVIE_MENTOR_TURN_SYNTHESIS_CONTRACT_MISSING")return 502;if(code.includes("TIMEOUT"))return 504;if(code.includes("RATE_LIMIT")||code.includes("UNAVAILABLE")||code.includes("NOT_CONFIGURED"))return 503;if(code.includes("AUTHENTICATION")||code.includes("INVALID_MODEL"))return 502;if(code.includes("INVALID")||code.includes("REQUIRED"))return 422;return 502;}

router.get("/health",(req,res)=>res.json({success:true,service:"movie-mentor-turn-gateway",version:MOVIE_MENTOR_TURN_GATEWAY_VERSION,runtimeVersion:MOVIE_MENTOR_TURN_RUNTIME_VERSION,orchestratorVersion:MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,contractVersion:MOVIE_MENTOR_TURN_CONTRACT_VERSION,wiring:{durableCreatorState:true,authoritativeTurnContext:true,semantic:true,specialists:true,synthesis:true},creatorStateStore:getMovieMentorCreatorStateStoreStatus(),authority:{serverSideDurableContextRequired:true,clientSuppliedMemoryIsNotAuthoritative:true,creatorTruthDominates:true,validatedSemanticsOutrankSpecialists:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,singleCreatorFacingMentor:true,mayAdvanceJourney:false}}));

router.post("/turn",async(req,res)=>{try{const result=await runMovieMentorTurn(req.body&&typeof req.body==="object"?req.body:{});return res.json({...result,metadata:{...(result.metadata||{}),turnGatewayVersion:MOVIE_MENTOR_TURN_GATEWAY_VERSION,turnRuntimeVersion:MOVIE_MENTOR_TURN_RUNTIME_VERSION}});}catch(error){const code=cleanString(error?.code)||"MOVIE_MENTOR_TURN_FAILED";return res.status(statusForCode(code)).json({success:false,code,message:error instanceof Error?error.message:"Movie Mentor turn failed.",validationIssues:Array.isArray(error?.validationIssues)?error.validationIssues:[],retryable:error?.retryable===true,authority:{serverSideDurableContextRequired:true,clientSuppliedMemoryIsNotAuthoritative:true,creatorTruthDominates:true,validatedSemanticsOutrankSpecialists:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,singleCreatorFacingMentor:true,mayAdvanceJourney:false}});}});

export {MOVIE_MENTOR_TURN_GATEWAY_VERSION};
export default router;
