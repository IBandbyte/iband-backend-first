import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE_URL=(process.env.IBAND_LIVE_BACKEND_URL||"https://iband-backend-first-1.onrender.com").replace(/\/$/,"");
const HEALTH_URL=`${BASE_URL}/api/movie-mentor-specialists/health`;
const EXECUTE_URL=`${BASE_URL}/api/movie-mentor-specialists/execute`;
const REPORT_PATH=process.env.IBAND_LIVE_REPORT_PATH||"verification-results/movie-mentor-specialists-live.json";
const report={generatedAt:new Date().toISOString(),baseUrl:BASE_URL,passed:false,provider:null,model:null,liveAgents:[],contributions:[],error:null};
function writeReport(){mkdirSync(dirname(REPORT_PATH),{recursive:true});writeFileSync(REPORT_PATH,`${JSON.stringify(report,null,2)}\n`,`utf8`);}
async function readJson(response){const text=await response.text();try{return text?JSON.parse(text):null;}catch{return {raw:text};}}

async function run(){
  const healthResponse=await fetch(HEALTH_URL,{headers:{Accept:"application/json"}}); const health=await readJson(healthResponse);
  assert.equal(healthResponse.ok,true,`specialist health failed ${healthResponse.status}`);
  assert.equal(health?.configured,true,"specialist provider not configured");
  assert.deepEqual(health?.liveAgents,["story","character"]);
  report.provider=health.providerName||null; report.model=health.model||null; report.liveAgents=health.liveAgents||[];

  const creatorConfirmedContext=[{key:"movie.character.relationship",value:"sisters",authority:"creator"}];
  const plan={version:"1.0.0",status:"planned",selectedAgents:["story","character"],workOrders:[
    {agentId:"story",purpose:"Story structure and dramatic direction.",input:{stageId:"story-direction",taskId:null,creatorMessage:"Two sisters discover their late mother's radio can receive messages from tomorrow.",semanticIntelligence:{understoodContext:[],provisionalContext:[],unresolvedContext:[],clarificationNeeded:[],readyToAdvance:true},creatorConfirmedContext,projectJourney:null},authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,requiresMentorSynthesis:true},
    {agentId:"character",purpose:"Character goals, relationships and arcs.",input:{stageId:"story-direction",taskId:null,creatorMessage:"Two sisters discover their late mother's radio can receive messages from tomorrow.",semanticIntelligence:{understoodContext:[],provisionalContext:[],unresolvedContext:[],clarificationNeeded:[],readyToAdvance:true},creatorConfirmedContext,projectJourney:null},authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,requiresMentorSynthesis:true}
  ]};
  const response=await fetch(EXECUTE_URL,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({plan})}); const body=await readJson(response);
  assert.equal(response.ok,true,`specialist execute failed (${response.status}): ${JSON.stringify(body)}`);
  assert.equal(Array.isArray(body?.contributions),true);
  assert.equal(body.contributions.length,2,"expected Story and Character contributions");
  for(const contribution of body.contributions){assert.equal(["story","character"].includes(contribution.agentId),true);assert.equal(contribution.authority,"mentor-provisional");assert.equal(contribution.creatorFacing,false);assert.equal(contribution.mayAdvanceJourney,false);assert.equal(contribution.mayOverwriteCreatorTruth,false);assert.equal(contribution.requiresMentorSynthesis,true);}
  report.contributions=body.contributions.map(c=>({agentId:c.agentId,observationCount:c.observations?.length||0,suggestionCount:c.provisionalSuggestions?.length||0,riskCount:c.risksAndConflicts?.length||0,confidence:c.confidence,authority:c.authority,mayAdvanceJourney:c.mayAdvanceJourney,creatorFacing:c.creatorFacing}));
  report.passed=true;
}

try{await run();}catch(error){report.error={message:error instanceof Error?error.message:String(error),code:error?.code||null};process.exitCode=1;}finally{writeReport();}
