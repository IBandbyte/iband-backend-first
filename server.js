import express from "express";
import cors from "cors";
import { configureMovieMentorJourneyRecoveryBootMount } from "./ai/MovieMentorJourneyRecoveryBootMountIntegration.js";

const app = express();
const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || "development";
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
async function mountRoute(basePath, importPath) { try { const mod=await import(importPath); const router=mod.default||mod; if(!router){console.log(`[mount:skip] ${basePath} -> ${importPath} (no_router_export)`);return;} app.use(basePath,router);console.log(`[mount:ok] ${basePath} -> ${importPath}`); } catch(error){ if(error?.code==="ERR_MODULE_NOT_FOUND"||error?.code==="MODULE_NOT_FOUND"){console.log(`[mount:skip] ${basePath} -> ${importPath} (missing_file)`);return;} console.log(`[mount:skip] ${basePath} -> ${importPath} (${error?.code||"load_error"})`); } }
app.get("/",(req,res)=>res.json({success:true,service:"iband-backend-first",app:"iBand",platform:"iBandbyte",company:"iBandbyte Ltd",environment:NODE_ENV,version:"movie-mentor-turn-orchestration",message:"iBand backend is live.",now:new Date().toISOString()}));
app.get("/health",(req,res)=>res.json({success:true,status:"ok",uptimeSec:Math.floor(process.uptime()),now:new Date().toISOString()}));
app.get("/api",(req,res)=>res.json({success:true,message:"iBand API root",modules:["smart-feed","personalised-feed","feed-diversity","engagement-optimiser","session-learning","predictive-feed","movie-mentor-turn","movie-mentor-semantic","movie-mentor-specialists","movie-mentor-synthesis"]}));
async function startServer(){
 await mountRoute("/api/smart-feed","./smartFeed.js"); await mountRoute("/api/personalised-feed","./personalisedFeed.js"); await mountRoute("/api/feed-diversity","./feedDiversity.js"); await mountRoute("/api/engagement-optimiser","./engagementOptimiser.js"); await mountRoute("/api/session-learning","./sessionLearning.js"); await mountRoute("/api/predictive-feed","./predictiveFeed.js");
 await mountRoute("/api/movie-mentor","./movieMentorTurn.js"); await mountRoute("/api/movie-mentor-semantic","./movieMentorSemantic.js"); await mountRoute("/api/movie-mentor-specialists","./movieMentorSpecialists.js"); await mountRoute("/api/movie-mentor-synthesis","./movieMentorSynthesis.js");
 const recoveryMount = configureMovieMentorJourneyRecoveryBootMount({
   app,
   verifyCredential: null,
   expectedIssuer: null,
   expectedAudience: null,
 });
 console.log(`[mount:${recoveryMount.mounted ? "ok" : "closed"}] ${recoveryMount.basePath} (${recoveryMount.reason})`);
 app.use((req,res)=>res.status(404).json({success:false,message:"Route not found"})); app.listen(PORT,()=>console.log(`[boot] iband-backend-first listening on port ${PORT}`));
}
startServer();
