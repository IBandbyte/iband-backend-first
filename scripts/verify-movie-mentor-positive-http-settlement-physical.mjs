import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import {execFileSync} from "node:child_process";
import express from "express";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorRequestAuthority } from "../ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorProjectOwnershipAuthority } from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorProductionInferenceExecutionComposition } from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";
import mongoose from "mongoose";
import { runMovieMentorTurnWithForwardExecutionAuthority } from "../ai/MovieMentorForwardExecutionRuntime.js";
import { readAuthoritativeTurnSource } from "../ai/MovieMentorCreatorStateStore.js";
import { orchestrateMovieMentorTurn } from "../ai/MovieMentorTurnOrchestrator.js";

// Fail-closed registration of the missing positive HTTP-origin settlement court.
// This verifier must not borrow the seeded canonical-settlement or replay GREENs.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//,"positive HTTP court requires loopback Mongo");
assert.match(uri,/replicaSet=/,"positive HTTP court requires an isolated replica set");
process.env.MONGO_URI=uri;
// Mirror the isolated provider identity configuration already used by the physical UNKNOWN court.
// These are non-production test credentials; no external provider request is authorized here.
process.env.IBAND_AI_PROVIDER="openai";
process.env.IBAND_AI_MODEL="gpt-isolated";
process.env.IBAND_AI_API_KEY="isolated-only";
const dbOwnership=db=>db.collection("movie_mentor_project_ownership");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const hello=await mongoose.connection.db.admin().command({hello:1});
 assert.ok(hello.setName,"positive HTTP court must use a replica set");
 const prefix=`positive-http-${process.pid}-${Date.now()}`;
 const creatorTurnId=`${prefix}-turn`;
 for(const [collection,query] of [
  ["movie_mentor_inference_execution",{creatorTurnId}],
  ["movie_mentor_inference_spend_reservation",{creatorTurnId}],
  ["movie_mentor_canonical_result",{creatorTurnId}],
 ]){
  assert.equal(await mongoose.connection.db.collection(collection).countDocuments(query),0,
   `positive HTTP-origin turn must not have a preseeded ${collection} record`);
 }
 console.log("GREEN positive HTTP precondition: isolated replica set, fresh creatorTurnId, no preseeded execution/reservation/canonical result");
 // Establish a real signed-JWT Express ingress boundary before constructing the positive runtime.
 const principalId=`${prefix}-owner`,projectId=`${prefix}-project`;
 const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
 const issuer="https://isolated-clerk.example.test",audience="isolated-movie-mentor",party="https://isolated-app.example.test";
 const authentication=createMovieMentorProductionAuthenticationComposition({env:{
  MOVIE_MENTOR_CLERK_JWT_KEY:publicKey.export({type:"spki",format:"pem"}),
  MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([party]),
  MOVIE_MENTOR_CLERK_ISSUER:issuer,MOVIE_MENTOR_AUDIENCE:audience
 }});
 const ownership=dbOwnership(mongoose.connection.db);
 await ownership.createIndex({projectId:1},{unique:true});
 await ownership.createIndex({establishmentAuthorityId:1},{unique:true});
 const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
 const established=await ownershipAuthority.establishNativeOwnership({
  principal:{authenticated:true,principalId},projectId,
  establishmentAuthority:{verified:true,type:"native-project-creation",authorityId:`${prefix}-native-mint`,principalId,projectId}
 });
 assert.equal(established.status,"established");
 const requestAuthority=createMovieMentorCreatorRequestAuthority({
  verifyCredential:authentication.verifyCredential,
  expectedIssuer:authentication.expectedIssuer,expectedAudience:authentication.expectedAudience,
  ownershipAuthority
 });
 const entitlements=mongoose.connection.db.collection("movie_mentor_inference_entitlement");
 await entitlements.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"active",remainingUnits:1,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 const creatorState=mongoose.connection.db.collection("movie_mentor_creator_state");
 await creatorState.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await creatorState.insertOne({projectId,revision:0,revisionAuthorityReference:`${prefix}-revision`,creatorStateGeneration:1,creatorStateFingerprint:`${prefix}-fingerprint`,creatorAuthorityReference:`${prefix}-authority`,snapshotReference:`${prefix}-snapshot`,capturedAt:new Date()});
 const providerRequests=[];
 const providerServer=http.createServer(async(req,res)=>{
  let body="";for await(const chunk of req)body+=chunk;
  providerRequests.push({path:req.url,method:req.method,idempotencyKey:req.headers["idempotency-key"]||null});
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
 const externalProvider=process.env.MOVIE_MENTOR_INDEPENDENT_PROVIDER_BASE_URL||"";
 if(externalProvider)assert.match(externalProvider,/^http:\/\/127\.0\.0\.1:\d+$/,"independent provider must be loopback");
 if(!externalProvider)await new Promise(resolve=>providerServer.listen(0,"127.0.0.1",resolve));
 process.env.IBAND_AI_BASE_URL=(externalProvider||"http://127.0.0.1:"+providerServer.address().port)+"/v1/responses";
 try{
 const spend=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(spend.ready,true,"physical spend composition required");
 const execution=createMovieMentorProductionInferenceExecutionComposition();
 assert.equal(execution.ready,true,"physical execution composition required");
 const settlement=createMovieMentorInferenceSettlementReconciliationAuthority({store:createMovieMentorInferenceSettlementMongoStore()});
 const router=createMovieMentorTurnRouter({
  requestAuthority,
  inferenceSpendAuthority:spend.authority,
  inferenceExecutionAuthority:execution.authority,
  inferenceSettlementAuthority:settlement,
  runTurn:async(body,deps)=>{
   try{return await runMovieMentorTurnWithForwardExecutionAuthority(body,{
    ...deps,readAuthoritativeTurnSource,orchestrateTurn:orchestrateMovieMentorTurn,
    createExecutionOwnerId:()=>`${prefix}-http-owner`
   });}catch(error){
    const chain=[];const seen=new Set();let current=error;
    for(let depth=0;depth<6&&current&&!seen.has(current);depth++){
     seen.add(current);chain.push({code:current.code||null,message:String(current.message||current).slice(0,300)});
     current=current.originalCause||current.cause||null;
    }
    console.log(`PHYSICAL POSITIVE ORCHESTRATION CAUSE CHAIN: ${JSON.stringify(chain)}`);
    throw error;
   }
  }
 });
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
 try{
  const now=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"isolated-key"})).toString("base64url");
  const payload=Buffer.from(JSON.stringify({sub:principalId,iss:issuer,aud:audience,azp:party,sid:"isolated-positive",iat:now-10,nbf:now-10,exp:now+300})).toString("base64url");
  const signingInput=`${header}.${payload}`;
  const jwt=`${signingInput}.${crypto.sign("RSA-SHA256",Buffer.from(signingInput),privateKey).toString("base64url")}`;
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/movie-mentor/turn`,{
   method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${jwt}`},
   body:JSON.stringify({projectId,creatorTurnId,message:"isolated positive creator turn",options:{}})
  });
  const responseBody=await response.json();
  console.log(`PHYSICAL POSITIVE HTTP RUNTIME: status=${response.status} code=${responseBody?.code||"none"} success=${responseBody?.success===true}`);
  const actualExecution=await mongoose.connection.db.collection("movie_mentor_inference_execution").findOne({creatorTurnId});
  const actualReservation=await mongoose.connection.db.collection("movie_mentor_inference_spend_reservation").findOne({principalId});
  console.log(`PHYSICAL POSITIVE DURABLE CHECKPOINT: execution=${actualExecution?.executionId||"none"} phase=${actualExecution?.phase||"none"} reservation=${actualReservation?.status||"none"} providerCalls=${actualExecution?.providerCallsClaimed??"unknown"}`);
  const effects=await mongoose.connection.db.collection("movie_mentor_provider_effect").find({executionId:actualExecution?.executionId||"none"}).project({providerCallId:1,status:1,effectStatus:1,slotId:1,task:1}).toArray();
  console.log(`PHYSICAL POSITIVE PROVIDER EFFECT CHECKPOINT: ${JSON.stringify(effects)}`);
  console.log(`PHYSICAL POSITIVE LOOPBACK PROVIDER REQUESTS: count=${providerRequests.length} external=${Boolean(externalProvider)}`);
  assert.equal(response.status,200,JSON.stringify(responseBody));
  assert.equal(responseBody.success,true);
  assert.equal(responseBody.status,"mentor-response-ready","initial HTTP contract must return the real mentor response state");
  assert.equal(actualExecution?.phase,"settled");
  assert.equal(actualExecution?.providerCallsClaimed,5);
  assert.equal(actualReservation?.status,"consumed");
  if(!externalProvider)assert.equal(providerRequests.length,5,"exactly five isolated provider requests expected");
  const canonical=await mongoose.connection.db.collection("movie_mentor_canonical_result").findOne({executionId:actualExecution.executionId});
  assert.ok(canonical,"HTTP-origin execution must have a durable canonical result");
  assert.equal(await mongoose.connection.db.collection("movie_mentor_canonical_result").countDocuments({executionId:actualExecution.executionId}),1);
  const entitlement=await entitlements.findOne({principalId});
  assert.equal(entitlement?.consumedUnits,1);
  assert.equal(entitlement?.remainingUnits,0);
  assert.equal(entitlement?.reservedUnits,0);
  console.log("GREEN positive signed-JWT HTTP turn: five real loopback provider calls, settled execution, consumed reservation and single durable canonical result");
  console.log("GREEN positive settlement ledger: exactly one consumed unit, zero remaining or reserved units");
  const replay=execFileSync(process.execPath,["scripts/verify-movie-mentor-isolated-settled-http-worker.mjs",actualExecution.executionId,principalId,projectId,creatorTurnId,"isolated positive creator turn","mentor-response-ready"],{encoding:"utf8",env:{...process.env,MOVIE_MENTOR_ISOLATED_MONGO_URI:uri},timeout:30000});
  console.log(replay);
 }finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }

 }finally{if(!externalProvider)await new Promise((resolve,reject)=>providerServer.close(error=>error?reject(error):resolve()));}
 console.log("GREEN POSITIVE_HTTP_SETTLEMENT_JOURNEY: real signed-JWT HTTP creation, loopback orchestration, durable canonical settlement and fresh-process signed-JWT replay verified.");
}finally{
 await mongoose.disconnect();
}
