import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";
import { executeStructuredAI } from "../ai/StructuredAIProviderClient.js";
import { runMovieMentorTurnWithForwardExecutionAuthority } from "../ai/MovieMentorForwardExecutionRuntime.js";
import express from "express";
import mongoose from "mongoose";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorRequestAuthority } from "../ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorProjectOwnershipAuthority } from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";
import { createMovieMentorProductionInferenceExecutionComposition, isMovieMentorProductionInferenceExecutionOwnerProof } from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import { buildRequestDigest } from "../ai/MovieMentorTurnRuntime.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//);
assert.match(uri,/replicaSet=/);
process.env.MONGO_URI=uri;
process.env.IBAND_AI_PROVIDER="openai";
process.env.IBAND_AI_MODEL="gpt-isolated";
process.env.IBAND_AI_API_KEY="isolated-only";
if(process.argv[2]==="--verify-unknown-http-retry"){
 const [executionId,principalId,projectId,creatorTurnId]=process.argv.slice(3);
 assert.ok(executionId&&principalId&&projectId&&creatorTurnId);
 const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
 const issuer="https://isolated-clerk.example.test",audience="isolated-movie-mentor",party="https://isolated-app.example.test";
 const authentication=createMovieMentorProductionAuthenticationComposition({env:{
  MOVIE_MENTOR_CLERK_JWT_KEY:publicKey.export({type:"spki",format:"pem"}),
  MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([party]),
  MOVIE_MENTOR_CLERK_ISSUER:issuer,MOVIE_MENTOR_AUDIENCE:audience
 }});
 function jwt(subject){
  const now=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"isolated-key"})).toString("base64url");
  const payload=Buffer.from(JSON.stringify({sub:subject,iss:issuer,aud:audience,azp:party,sid:"isolated-retry",iat:now-10,nbf:now-10,exp:now+300})).toString("base64url");
  const input=`${header}.${payload}`;
  return `${input}.${crypto.sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url")}`;
 }
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 let retryServer;
 try{
  const db=mongoose.connection.db;
  const reservationCollection=db.collection("movie_mentor_inference_spend_reservation");
  const entitlementCollection=db.collection("movie_mentor_inference_entitlement");
  const effectCollection=db.collection("movie_mentor_provider_effect_reality");
  const beforeReservation=await reservationCollection.findOne({principalId});
  const beforeEntitlement=await entitlementCollection.findOne({principalId});
  const beforeEffect=await effectCollection.findOne({executionId});
  const executionCollection=db.collection("movie_mentor_inference_execution");
  const beforeExecution=await executionCollection.findOne({executionId});
  assert.equal(beforeExecution?.phase,"active");
  const takeoverMode=process.argv[7]==="--expired-lease";
  if(takeoverMode){
   const expired=new Date(Date.now()-120000).toISOString();
   const acquired=new Date(Date.now()-240000).toISOString();
   const result=await executionCollection.updateOne({
    executionId,leaseGeneration:beforeExecution.leaseGeneration,
    leaseReference:beforeExecution.leaseReference
   },{$set:{leaseAcquiredAt:acquired,leaseExpiresAt:expired}});
   assert.equal(result.modifiedCount,1,"isolated test must expire exactly the target lease");
  }

  assert.equal(beforeEffect?.state,"unknown");
  const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
  const requestAuthority=createMovieMentorCreatorRequestAuthority({
   verifyCredential:authentication.verifyCredential,
   expectedIssuer:authentication.expectedIssuer,expectedAudience:authentication.expectedAudience,
   ownershipAuthority
  });
  const spend=createMovieMentorProductionInferenceSpendComposition();
  const composed=createMovieMentorProductionInferenceExecutionComposition();
  assert.equal(composed.ready,true);
  if(takeoverMode){
   const taken=await composed.authority.acquireExecution({executionId,ownerId:`isolated-takeover-${process.pid}`});
   assert.equal(taken.authorized,true,"expired lease must permit genuine owner takeover");
   assert.equal(taken.acquired,true,"takeover must advance lease, not reuse old owner");
   assert.equal(taken.leaseGeneration,beforeExecution.leaseGeneration+1);
   assert.equal((await executionCollection.findOne({executionId})).providerCallsClaimed,1);
   assert.deepEqual(await effectCollection.findOne({executionId}),beforeEffect);
   console.log("GREEN physical expired-lease takeover advances owner generation while durable provider UNKNOWN remains immutable");
  }
  const forbidden=()=>{throw Error("UNKNOWN HTTP retry must not reserve, dispatch or read mutable creator state");};
  const guardedSpend={...spend.authority,reserveTurn:forbidden};
  const settlement={reconcile:forbidden,releaseUnclaimed:forbidden,releaseUnbound:forbidden};
  let calls=0;
  const router=createMovieMentorTurnRouter({
   requestAuthority,inferenceSpendAuthority:guardedSpend,
   inferenceExecutionAuthority:composed.authority,inferenceSettlementAuthority:settlement,
   runTurn:async(body,deps)=>{
    calls++;
    return runMovieMentorTurnWithForwardExecutionAuthority(body,{
     ...deps,readAuthoritativeTurnSource:forbidden,orchestrateTurn:forbidden,
     createExecutionOwnerId:()=>`isolated-restarted-owner-${process.pid}`
    });
   }
  });
  const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
  retryServer=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  const url=`http://127.0.0.1:${retryServer.address().port}/api/movie-mentor/turn`;
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${jwt(principalId)}`},
   body:JSON.stringify({projectId,creatorTurnId,message:"isolated",options:{}})});
  assert.notEqual(response.status,200,"UNKNOWN HTTP retry must not expose completion");
  const retryFailure=await response.json();
  assert.equal(typeof retryFailure.code,"string","retry denial must carry a machine-readable error code");
  assert.notEqual(retryFailure.code,"MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_STATE_PROOF_REQUIRED","retry must not pass merely because a test fixture omits creator-state provenance");
  assert.notEqual(retryFailure.code,"MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_AUTHORITY_REQUIRED","retry must not pass merely because a test fixture omits consumption authority");
  console.log(`PHYSICAL UNKNOWN RETRY DENIAL CODE: ${retryFailure.code}`);
  assert.equal(calls,1,"authenticated retry must enter actual forward runtime");
  assert.deepEqual(await reservationCollection.findOne({principalId}),beforeReservation);
  assert.deepEqual(await entitlementCollection.findOne({principalId}),beforeEntitlement);
  assert.deepEqual(await effectCollection.findOne({executionId}),beforeEffect);
  assert.equal(await reservationCollection.countDocuments({principalId}),1);
  assert.equal(await effectCollection.countDocuments({executionId}),1);
  console.log(takeoverMode?"GREEN authenticated HTTP retry after isolated expired-lease takeover denies completion without second spend or effect":"GREEN fresh-process authenticated HTTP UNKNOWN retry -> real forward runtime denies completion without new spend or provider effect");
 }finally{
  if(retryServer)await new Promise(resolve=>retryServer.close(resolve));
  await mongoose.disconnect();
 }
 process.exit(0);
}
if(process.argv[2]==="--verify-unknown-restart"){
 const callId=process.argv[3];
 assert.match(callId||"",/^provider-call-[a-zA-Z0-9-]+$/);
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 try{
  const db=mongoose.connection.db;
  const operationStore=createMovieMentorProviderOperationMongoStore();
  const operation=await operationStore.readOperation(callId);
  assert.equal(operation?.providerCallId,callId);
  const effect=await db.collection("movie_mentor_provider_effect_reality").findOne({providerCallId:callId});
  assert.equal(effect?.state,"unknown");
  const execution=await db.collection("movie_mentor_inference_execution").findOne({executionId:operation.executionId});
  assert.equal(execution?.providerCallsClaimed,1);
  const recovery=createMovieMentorProviderOutcomeRecoveryAuthority({
   readProviderOperation:key=>operationStore.readOperation(key),
   readProviderEffectReality:key=>db.collection("movie_mentor_provider_effect_reality").findOne({providerCallId:key}),
   recoverProviderResponse:async()=>{throw Error("UNKNOWN cannot recover a missing provider response");},
   resolveCurrentTarget:()=>operation.providerTarget
  });
  const verdict=await recovery.reconcile({providerCallId:callId});
  assert.equal(verdict.outcome,"STILL_UNKNOWN");
  for(const key of ["redispatchAuthorized","refundAuthorized","recoveryAuthorized"])assert.equal(verdict[key],false);
  console.log("GREEN fresh-worker authenticated-origin socket-loss UNKNOWN -> no redispatch/refund/recovery");
 }finally{await mongoose.disconnect();}
 process.exit(0);
}

const suffix=`jwt-http-${process.pid}-${Date.now()}`;
const principalId=`${suffix}-owner`,projectId=`${suffix}-project`;
const issuer="https://isolated-clerk.example.test",audience="isolated-movie-mentor",party="https://isolated-app.example.test";
const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const jwtPublicKey=publicKey.export({type:"spki",format:"pem"});
function token(subject,override={}){
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"isolated-key"})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({sub:subject,iss:issuer,aud:audience,azp:party,sid:`${suffix}-session`,iat:now-10,nbf:now-10,exp:now+300,...override})).toString("base64url");
 const signingInput=`${header}.${payload}`;
 const signature=crypto.sign("RSA-SHA256",Buffer.from(signingInput),privateKey).toString("base64url");
 return `${signingInput}.${signature}`;
}
const authentication=createMovieMentorProductionAuthenticationComposition({env:{
 MOVIE_MENTOR_CLERK_JWT_KEY:jwtPublicKey,
 MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([party]),
 MOVIE_MENTOR_CLERK_ISSUER:issuer,MOVIE_MENTOR_AUDIENCE:audience
}});
assert.equal(authentication.ready,true);
const dbConnection=await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=dbConnection.connection.db;
let server,socketServer;
const acceptedSockets=[];
try{
 socketServer=http.createServer(async(req,res)=>{
  let body="";for await(const chunk of req)body+=chunk;
  acceptedSockets.push({key:req.headers["idempotency-key"],body:JSON.parse(body)});
  res.destroy();
 });
 await new Promise(resolve=>socketServer.listen(0,"127.0.0.1",resolve));
 process.env.IBAND_AI_BASE_URL=`http://127.0.0.1:${socketServer.address().port}/v1/responses`;
 const ownership=db.collection("movie_mentor_project_ownership");
 await ownership.createIndex({projectId:1},{unique:true});
 await ownership.createIndex({establishmentAuthorityId:1},{unique:true});
 const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
 const established=await ownershipAuthority.establishNativeOwnership({
  principal:{authenticated:true,principalId},projectId,
  establishmentAuthority:{verified:true,type:"native-project-creation",authorityId:`${suffix}-mint`,principalId,projectId}
 });
 assert.equal(established.status,"established");
 const entitlement=db.collection("movie_mentor_inference_entitlement");
 await entitlement.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"active",remainingUnits:1,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 const spend=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(spend.ready,true);
 const requestAuthority=createMovieMentorCreatorRequestAuthority({
  verifyCredential:authentication.verifyCredential,
  expectedIssuer:authentication.expectedIssuer,
  expectedAudience:authentication.expectedAudience,
  ownershipAuthority
 });
 const executionCollection=db.collection("movie_mentor_inference_execution");
 await executionCollection.createIndex({executionId:1},{unique:true});
 await executionCollection.createIndex({principalId:1,projectId:1,creatorTurnId:1},{unique:true});
 await executionCollection.createIndex({reservationId:1},{unique:true});
 await db.collection("movie_mentor_provider_operation_reality").createIndex({providerCallId:1},{unique:true});
 await db.collection("movie_mentor_provider_effect_reality").createIndex({providerCallId:1},{unique:true});
 const productionExecution=createMovieMentorProductionInferenceExecutionComposition();
 assert.equal(productionExecution.ready,true,`production execution composition: ${productionExecution.reason}`);
 assert.equal(isMovieMentorProductionInferenceExecutionOwnerProof(productionExecution,productionExecution.status),true);
 let exposureAttempt=false;
 let runCalls=0;
 const executionMethods=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
 const execution=Object.fromEntries(executionMethods.map(key=>[key,async()=>{throw Error(`unexpected execution: ${key}`)}]));
 const settlement={reconcile:async()=>{throw Error("unexpected settlement");},releaseUnclaimed:async()=>{throw Error("unexpected release");},releaseUnbound:async()=>{throw Error("unexpected release");}};
 const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend.authority,
  inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
  runTurn:async(_body,{serverAuthority,forwardExecutionAuthority})=>{
   runCalls++;
   if(exposureAttempt)return {message:"forged completion",metadata:{canonicalResult:{
    creatorResponseAuthorityVerified:true,executionId:`${suffix}-fabricated-execution`,resultDigest:"fabricated-digest"
   }}};
   const reserved=await spend.authority.reserveTurn({serverAuthority,projectId:serverAuthority.projectId});
   assert.equal(reserved.authorized,true);
   const opened=await productionExecution.authority.openExecution({
    creatorTurnId:_body.creatorTurnId,principalId:serverAuthority.principalId,
    projectId:serverAuthority.projectId,reservationId:reserved.reservationId,
    requestDigest:buildRequestDigest({creatorMessage:_body.message,projectId:serverAuthority.projectId,options:_body.options||{}}),
    ownerId:`${suffix}-http-creator-owner`,
    assertCurrentCreationAuthority:forwardExecutionAuthority.assertCurrentCreation
   });
   assert.equal(opened.authorized,true);
   assert.equal(opened.phase,"active");
   assert.equal(opened.created,true);
   const admitted=await productionExecution.authority.claimProviderCall({
    execution:opened,slotId:"isolated-pre-dispatch-slot",task:"isolated-pre-dispatch-task",
    assertCurrentProviderCallAdmissionAuthority:forwardExecutionAuthority.assertCurrentProviderCallAdmission
   });
   assert.equal(admitted.authorized,true);
   assert.equal(admitted.dispatchAuthorized,true);
   assert.equal(admitted.providerCallsClaimed,1);
   const unknown=await productionExecution.authority.beginProviderDispatch({
    providerCall:admitted,
    assertCurrentProviderEffectUnknownAuthority:forwardExecutionAuthority.assertCurrentProviderEffectUnknown
   });
   assert.equal(unknown.dispatchAuthorized,true);
   assert.equal(unknown.effectState,"unknown");
   const durableEffect=await db.collection("movie_mentor_provider_effect_reality").findOne({providerCallId:admitted.providerCallId});
   assert.equal(durableEffect.state,"unknown","durable UNKNOWN must precede socket");
   await assert.rejects(()=>executeStructuredAI({
    task:"isolated-pre-dispatch-task",systemInstructions:"Return JSON.",
    input:{isolated:true},
    schema:{type:"object",additionalProperties:false,properties:{value:{type:"string"}},required:["value"]},
    schemaName:"isolated_authenticated_http_socket_loss",
    providerOperation:{providerOperationId:admitted.providerCallId,executionId:opened.executionId,slotId:admitted.slotId,task:admitted.task}
   }));
   assert.equal(acceptedSockets.length,1,"provider socket must accept exactly one request");
   assert.equal(acceptedSockets[0].key,admitted.providerCallId);
   const error=new Error("Isolated post-reservation stop: never dispatch provider");
   error.code="MOVIE_MENTOR_INFERENCE_EXECUTION_UNRESOLVED";
   throw error;
  }
 });
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
 const url=`http://127.0.0.1:${server.address().port}/api/movie-mentor/turn`;
 async function post(authorization){
  const headers={"content-type":"application/json"};
  if(authorization)headers.authorization=`Bearer ${authorization}`;
  const response=await fetch(url,{method:"POST",headers,body:JSON.stringify({projectId,creatorTurnId:`${suffix}-turn`,message:"isolated"})});
  return {status:response.status,body:await response.json()};
 }
 const before=await entitlement.findOne({principalId});
 const missing=await post(null);assert.equal(missing.status,401);
 const invalid=await post(token(principalId).slice(0,-5)+"xxxxx");assert.equal(invalid.status,401);
 const nonOwner=await post(token(`${suffix}-intruder`));assert.equal(nonOwner.status,403);
 assert.equal(runCalls,0,"rejected HTTP requests must never enter turn runtime");
 assert.deepEqual(await entitlement.findOne({principalId}),before,"rejected requests must never debit entitlement");
 assert.equal(await db.collection("movie_mentor_inference_spend_reservation").countDocuments({principalId}),0);
 const owner=await post(token(principalId));
 assert.equal(owner.status,503,"authorized request stops safely after isolated reservation");
 assert.equal(runCalls,1);
 assert.equal(await executionCollection.countDocuments({principalId,projectId}),1);
 const createdExecution=await executionCollection.findOne({principalId,projectId});
 assert.equal(createdExecution.phase,"active");
 assert.equal(createdExecution.schema,6);
 assert.equal(createdExecution.providerCallsClaimed,1);
 assert.equal(createdExecution.providerCalls.length,1);
 const effects=db.collection("movie_mentor_provider_effect_reality");
 assert.equal(await effects.countDocuments({executionId:createdExecution.executionId}),1);
 const effect=await effects.findOne({executionId:createdExecution.executionId});
 assert.equal(effect.state,"unknown");
 const operations=db.collection("movie_mentor_provider_operation_reality");
 assert.equal(await operations.countDocuments({executionId:createdExecution.executionId}),1);
 const operation=await operations.findOne({executionId:createdExecution.executionId});
 assert.equal(operation.providerCallId,effect.providerCallId);
 assert.equal(operation.providerTarget.provider,"openai");
 const child=spawnSync(process.execPath,[new URL(import.meta.url).pathname,"--verify-unknown-restart",effect.providerCallId],{
  encoding:"utf8",timeout:30000,env:{...process.env,MOVIE_MENTOR_ISOLATED_MONGO_URI:uri}
 });
 assert.equal(child.status,0,`fresh worker failed: ${child.stderr} ${child.stdout}`);
 assert.match(child.stdout,/GREEN fresh-worker authenticated-origin socket-loss UNKNOWN/);
 assert.equal(await effects.countDocuments({executionId:createdExecution.executionId}),1);
 assert.equal((await executionCollection.findOne({executionId:createdExecution.executionId})).providerCallsClaimed,1);

 assert.equal(acceptedSockets.length,1);
 const retry=spawnSync(process.execPath,[new URL(import.meta.url).pathname,"--verify-unknown-http-retry",
  createdExecution.executionId,principalId,projectId,`${suffix}-turn`],{
  encoding:"utf8",timeout:30000,env:{...process.env,MOVIE_MENTOR_ISOLATED_MONGO_URI:uri}
 });
 assert.equal(retry.status,0,`HTTP retry worker failed: ${retry.stderr} ${retry.stdout}`);
 assert.match(retry.stdout,/GREEN fresh-process authenticated HTTP UNKNOWN retry/);
 assert.equal(acceptedSockets.length,1,"HTTP retry must not dispatch another provider socket");
 const takeover=spawnSync(process.execPath,[new URL(import.meta.url).pathname,"--verify-unknown-http-retry",
  createdExecution.executionId,principalId,projectId,`${suffix}-turn`,"--expired-lease"],{
  encoding:"utf8",timeout:30000,env:{...process.env,MOVIE_MENTOR_ISOLATED_MONGO_URI:uri}
 });
 assert.equal(takeover.status,0,`expired-lease takeover worker failed: ${takeover.stderr} ${takeover.stdout}`);
 assert.match(takeover.stdout,/GREEN physical expired-lease takeover/);
 assert.match(takeover.stdout,/GREEN authenticated HTTP retry after isolated expired-lease takeover/);
 assert.equal(acceptedSockets.length,1,"expired-lease takeover must not redispatch provider socket");
 assert.equal(await effects.countDocuments({executionId:createdExecution.executionId}),1);

 exposureAttempt=true;
 const forged=await post(token(principalId));
 assert.notEqual(forged.status,200,"HTTP gateway must refuse forged runtime completion");
 assert.equal(runCalls,2);
 assert.equal(await db.collection("movie_mentor_inference_spend_reservation").countDocuments({principalId}),1);
 console.log("GREEN authenticated HTTP gateway denies forged completed response before exposure without a second reservation");
 exposureAttempt=false;
 const after=await entitlement.findOne({principalId});
 assert.equal(after.remainingUnits,0);assert.equal(after.reservedUnits,1);
 assert.equal(await db.collection("movie_mentor_inference_spend_reservation").countDocuments({principalId}),1);
 console.log("GREEN real signed RS256 Clerk-verifier JWT over HTTP + durable owner authorization");
 console.log("GREEN missing, tampered and non-owner HTTP credentials denied before spend");
 console.log("GREEN owner HTTP ingress -> production-composed durable spend reservation");
 console.log("GREEN fresh authenticated HTTP turn -> real current-ownership execution-creation proof -> production-composed schema-6 Mongo execution");
 console.log("GREEN authenticated HTTP current-owner provider-call admission -> exactly one durable claim");
 console.log("GREEN authenticated HTTP current-owner UNKNOWN transition -> immutable provider operation and one durable UNKNOWN effect before socket dispatch");
 console.log("GREEN authenticated HTTP chain -> exactly one provider socket accepted then response lost, durable UNKNOWN retained");
 console.log("GREEN fresh worker independently reads HTTP-origin durable UNKNOWN and denies redispatch, refund and speculative recovery");
 console.log("GREEN fresh-process authenticated HTTP UNKNOWN retry uses actual forward runtime, denies completion and leaves spend/effect immutable");
 console.log("GREEN physical expired-lease takeover + authenticated HTTP retry preserve one UNKNOWN provider effect and one accepted socket");
 console.log("LIMITATION: locally generated isolated RSA test keys and native ownership fixture; injected runtime simulates socket loss after durable UNKNOWN; expired-lease takeover tested with a separate fresh worker; full resumed orchestration and positive settlement journey not certified.");
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 if(socketServer)await new Promise(resolve=>socketServer.close(resolve));
 await mongoose.disconnect();
}
