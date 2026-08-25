import express from "express";
import { orchestrateMovieMentorTurn, MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION, MOVIE_MENTOR_TURN_CONTRACT_VERSION } from "./ai/MovieMentorTurnOrchestrator.js";

const router=express.Router();
const MOVIE_MENTOR_TURN_GATEWAY_VERSION="1.0.0";
function cleanString(value){return typeof value==="string"?value.trim():"";}
function statusForCode(code){if(code==="MOVIE_MENTOR_TURN_MESSAGE_REQUIRED")return 400;if(code==="MOVIE_MENTOR_TURN_SEMANTIC_CONTRACT_MISSING"||code==="MOVIE_MENTOR_TURN_SYNTHESIS_CONTRACT_MISSING")return 502;if(code.includes("TIMEOUT"))return 504;if(code.includes("RATE_LIMIT")||code.includes("UNAVAILABLE")||code.includes("NOT_CONFIGURED"))return 503;if(code.includes("AUTHENTICATION")||code.includes("INVALID_MODEL"))return 502;if(code.includes("INVALID")||code.includes("REQUIRED"))return 422;return 502;}

router.get("/health",(req,res)=>res.json({success:true,service:"movie-mentor-turn-gateway",version:MOVIE_MENTOR_TURN_GATEWAY_VERSION,orchestratorVersion:MOVIE_MENTOR_TURN_ORCHESTRATOR_VERSION,contractVersion:MOVIE_MENTOR_TURN_CONTRACT_VERSION,wiring:{semantic:true,specialists:true,synthesis:true},authority:{creatorTruthDominates:true,validatedSemanticsOutrankSpecialists:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,singleCreatorFacingMentor:true,mayAdvanceJourney:false}}));

router.post("/turn",async(req,res)=>{try{const result=await orchestrateMovieMentorTurn(req.body&&typeof req.body==="object"?req.body:{});return res.json({...result,metadata:{...(result.metadata||{}),turnGatewayVersion:MOVIE_MENTOR_TURN_GATEWAY_VERSION}});}catch(error){const code=cleanString(error?.code)||"MOVIE_MENTOR_TURN_FAILED";return res.status(statusForCode(code)).json({success:false,code,message:error instanceof Error?error.message:"Movie Mentor turn failed.",validationIssues:Array.isArray(error?.validationIssues)?error.validationIssues:[],retryable:error?.retryable===true,authority:{creatorTruthDominates:true,validatedSemanticsOutrankSpecialists:true,specialistsRemainProvisional:true,specialistsMaySpeakDirectlyToCreator:false,singleCreatorFacingMentor:true,mayAdvanceJourney:false}});}});

export {MOVIE_MENTOR_TURN_GATEWAY_VERSION};
export default router;
