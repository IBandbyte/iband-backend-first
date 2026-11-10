import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
import mongoose from "mongoose";

// Independent provider survives in supervisor while the signed-HTTP runtime
// executes in a separate process. This is a positive topology court only;
// SIGKILL/recovery-to-settlement is NOT certified by this verifier.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.ok(uri.startsWith("mongodb://127.0.0.1:27017/movie_mentor_positive_http_settlement?"),"refuse non-disposable Mongo target");
const providerRequests=[];
 const providerServer=http.createServer(async(req,res)=>{
  let body="";for await(const chunk of req)body+=chunk;
  providerRequests.push({path:req.url,method:req.method,idempotencyKey:req.headers["idempotency-key"]||null});
  // Hold the second provider response while the first confirmed effect is
  // inspected in Mongo; this makes the pre-finalization crash window physical.
  if(req.method==="POST"&&req.url==="/v1/responses"&&providerRequests.filter(r=>r.method==="POST"&&r.path==="/v1/responses").length===2){
   await new Promise(resolve=>setTimeout(resolve,12000));
  }
  let requestBody;
  try{requestBody=JSON.parse(body);}catch{
   res.writeHead(400,{"content-type":"application/json"});
   res.end(JSON.stringify({error:{message:"Invalid isolated provider JSON"}}));
   return;
  }
  const schema=requestBody?.text?.format?.schema;
  console.log("PHYSICAL POSITIVE PROVIDER SCHEMA: "+JSON.stringify({
   schemaName:requestBody?.text?.format?.name||null,
   topLevelRequired:Array.isArray(schema?.required)?schema.required:[],
   topLevelProperties:Object.keys(schema?.properties||{}),
   propertyContracts:Object.fromEntries(Object.entries(schema?.properties||{}).map(([key,value])=>[key,{type:value?.type||null,required:value?.required||[],properties:Object.keys(value?.properties||{}),itemsType:value?.items?.type||null,itemRequired:value?.items?.required||[],itemProperties:Object.fromEntries(Object.entries(value?.items?.properties||{}).map(([k,v])=>[k,{type:v?.type||null,enum:v?.enum||null}])),nextActionRequired:value?.properties?.required||[],nextActionProperties:Object.fromEntries(Object.entries(value?.properties||{}).map(([k,v])=>[k,{type:v?.type||null,enum:v?.enum||null}])),enum:value?.enum||null}])),
   model:requestBody?.model||null
  }));
  if(requestBody?.text?.format?.name==="movie_journey_intelligence"){
   const semantic={
    understoodContext:[{key:"creator.intent",value:"isolated positive creator turn",evidence:"isolated positive creator turn",confidenceSource:"creator-explicit"}],
    provisionalContext:[],unresolvedContext:[],clarificationNeeded:[],readyToAdvance:true,
    recommendedStageId:null,recommendedTaskId:null,nextAction:null,resumeNote:null
   };
   res.writeHead(200,{"content-type":"application/json"});
   res.end(JSON.stringify({id:"isolated-semantic-response-1",model:"gpt-isolated",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(semantic)}]}]}));
   return;
  }
  const schemaName=requestBody?.text?.format?.name||"";
  if(["movie_mentor_story_contribution","movie_mentor_character_contribution","movie_mentor_continuity_contribution"].includes(schemaName)){
   const requiredAgent=schema?.properties?.agentId?.enum?.[0];
   const fixture={
    agentId:requiredAgent,
    confidence:0.9,
    provenance:{source:"isolated-local-provider",model:"gpt-isolated",contractVersion:"1"},
   };
   for(const field of schema?.required||[]){
    if(field in fixture)continue;
    const property=schema?.properties?.[field];
    if(property?.type==="array")fixture[field]=[];
    else if(property?.type==="boolean")fixture[field]=false;
    else if(property?.type==="number")fixture[field]=0.9;
    else if(property?.type==="string")fixture[field]=property?.enum?.[0]||"isolated";
    else if(property?.type==="object")fixture[field]={};
    else fixture[field]=null;
   }
   const responseId="isolated-"+schemaName+"-"+providerRequests.length;
   res.writeHead(200,{"content-type":"application/json"});
   res.end(JSON.stringify({id:responseId,model:"gpt-isolated",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(fixture)}]}]}));
   return;
  }
  if(schemaName==="movie_mentor_synthesis"){
   const synthesis={
    text:"I understand your isolated creator request. What would you like to develop next?",
    usedContributionAgentIds:["story","character","continuity"],
    deferredContributionAgentIds:[],
    continuationObedienceClaims:[],
    conflictsHandled:[],
    confidence:0.9,
    provenance:{source:"isolated-local-provider",model:"gpt-isolated",contractVersion:"1"}
   };
   res.writeHead(200,{"content-type":"application/json"});
   res.end(JSON.stringify({id:"isolated-synthesis-response-1",model:"gpt-isolated",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(synthesis)}]}]}));
   return;
  }
  res.writeHead(503,{"content-type":"application/json"});
  res.end(JSON.stringify({error:{message:"Unimplemented isolated provider stage: "+String(requestBody?.text?.format?.name||"unknown"),type:"isolated_fixture_pending"}}));
 });

await new Promise(resolve=>providerServer.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+providerServer.address().port;
let stdout="",stderr="";
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=mongoose.connection.db;
const previousEffectIds=(await db.collection("movie_mentor_provider_effect_reality").find({}).project({_id:1}).toArray()).map(x=>x._id);
const child=spawn(process.execPath,["scripts/verify-movie-mentor-positive-http-settlement-physical.mjs"],{
 env:{...process.env,MOVIE_MENTOR_INDEPENDENT_PROVIDER_BASE_URL:base},stdio:["ignore","pipe","pipe"]
});
child.stdout.on("data",chunk=>{stdout+=chunk.toString();process.stdout.write(chunk);});
child.stderr.on("data",chunk=>{stderr+=chunk.toString();process.stderr.write(chunk);});
const watchdog=setTimeout(()=>child.kill("SIGKILL"),90000);
try{
 const deadline=Date.now()+45000;
 let effect=null,execution=null;
 while(Date.now()<deadline){
  effect=await db.collection("movie_mentor_provider_effect_reality").findOne({_id:{$nin:previousEffectIds},state:"confirmed"});
  if(effect){
   execution=await db.collection("movie_mentor_inference_execution").findOne({executionId:effect.executionId});
   if(execution?.phase==="active")break;
   effect=null;execution=null;
  }
  if(child.exitCode!==null)throw Error("signed HTTP worker exited before durable effect confirmation: "+stdout.slice(-1500)+" "+stderr.slice(-1500));
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.ok(effect,"physical Mongo provider effect must be durably confirmed before SIGKILL");
 assert.ok(execution,"fresh confirmed effect must bind to the current active HTTP-origin execution");
 assert.ok(Array.isArray(effect.evidence)&&effect.evidence.length>0,"confirmed effect requires durable response evidence");
 assert.equal(execution.phase,"active","kill must occur before finalization");
 const postsBefore=providerRequests.filter(r=>r.method==="POST"&&r.path==="/v1/responses").length;
 assert.ok(postsBefore>=1,"provider must have received a real HTTP POST");
 child.kill("SIGKILL");
 const {code,signal}=await new Promise(resolve=>child.on("exit",(code,signal)=>resolve({code,signal})));
 assert.equal(code,null);assert.equal(signal,"SIGKILL");
 assert.equal(providerServer.listening,true,"provider must survive worker SIGKILL");
 const persisted=await db.collection("movie_mentor_provider_effect_reality").findOne({_id:effect._id});
 assert.ok(persisted,"durable effect must survive worker SIGKILL");
 const after=await db.collection("movie_mentor_inference_execution").findOne({executionId:execution.executionId});
 assert.ok(after,"HTTP-origin execution must survive worker SIGKILL");
 assert.equal(after.phase,"active","worker crash must not be mistaken for canonical settlement");
 assert.equal(providerRequests.filter(r=>r.method==="POST"&&r.path==="/v1/responses").length,postsBefore,"SIGKILL must not redispatch provider");
 // A second Node process must independently recover the persisted facts, not
 // inherit the supervisor's Mongoose connection or any in-memory authority.
 const inspectorSource=[
  'import mongoose from "mongoose";',
  'const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;',
  'if(!uri?.startsWith("mongodb://127.0.0.1:27017/movie_mentor_positive_http_settlement?"))process.exit(31);',
  'await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});',
  'try{',
  'const db=mongoose.connection.db;',
  'const execution=await db.collection("movie_mentor_inference_execution").findOne({executionId:process.env.MOVIE_MENTOR_INSPECT_EXECUTION_ID});',
  'const effect=await db.collection("movie_mentor_provider_effect_reality").findOne({providerCallId:process.env.MOVIE_MENTOR_INSPECT_CALL_ID});',
  'const operation=await db.collection("movie_mentor_provider_operation_reality").findOne({providerCallId:process.env.MOVIE_MENTOR_INSPECT_CALL_ID});',
  'if(!execution||execution.phase!=="active"||!effect||effect.state!=="confirmed"||effect.executionId!==execution.executionId||!operation||operation.executionId!==execution.executionId)process.exitCode=32;',
  'else console.log("GREEN FRESH_PROCESS_DURABLE_RECOVERY_INPUTS: execution active; confirmed effect and bound provider operation independently readable");',
  '}finally{await mongoose.disconnect();}'
 ].join("\n");
 const inspector=spawn(process.execPath,["--input-type=module","-e",inspectorSource],{
  env:{...process.env,MOVIE_MENTOR_INSPECT_EXECUTION_ID:execution.executionId,MOVIE_MENTOR_INSPECT_CALL_ID:effect.providerCallId},
  stdio:["ignore","pipe","pipe"]
 });
 let inspectorOut="",inspectorErr="";
 inspector.stdout.on("data",chunk=>{inspectorOut+=chunk.toString();process.stdout.write(chunk);});
 inspector.stderr.on("data",chunk=>{inspectorErr+=chunk.toString();process.stderr.write(chunk);});
 const inspectorExit=await new Promise(resolve=>inspector.on("exit",(code,signal)=>resolve({code,signal})));
 assert.equal(inspectorExit.code,0,"fresh process failed durable recovery-input inspection: "+inspectorErr+" "+inspectorOut);
 assert.match(inspectorOut,/GREEN FRESH_PROCESS_DURABLE_RECOVERY_INPUTS/);
 assert.equal(providerRequests.filter(r=>r.method==="POST"&&r.path==="/v1/responses").length,postsBefore,"fresh inspector must not redispatch provider");
 console.log("GREEN SIGNED_HTTP_DURABLE_EFFECT_SIGKILL_GATE: HTTP-origin active execution and durable provider effect observed in Mongo before SIGKILL; independent provider and durable evidence survived");
 console.log("LIMITATION: no fresh-worker recovery, canonical finalization or exactly-once settlement certified.");
}finally{
 clearTimeout(watchdog);
 if(child.exitCode===null)child.kill("SIGKILL");
 await mongoose.disconnect();
 await new Promise(resolve=>providerServer.close(resolve));
}
