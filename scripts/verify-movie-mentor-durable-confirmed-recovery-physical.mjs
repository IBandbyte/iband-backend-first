import assert from "node:assert/strict";
import http from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {once} from "node:events";
import mongoose from "mongoose";
import {createMovieMentorProviderOperationMongoStore} from "../ai/MovieMentorProviderOperationMongoStore.js";
import {createMovieMentorProviderEffectMongoStore} from "../ai/MovieMentorProviderEffectMongoStore.js";
import {createMovieMentorProviderEffectAuthority} from "../ai/MovieMentorProviderEffectAuthority.js";
import {createMovieMentorProviderOutcomeRecoveryAuthority} from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/movie_mentor_confirmed_settlement_baseline?replicaSet=rs0&directConnection=true","disposable Mongo only");
process.env.MONGO_URI=uri;
const callId="physical-confirmed-call-1",executionId="physical-confirmed-execution-1",responseId="physical-confirmed-response-1";
const target=Object.freeze({provider:"openai",adapter:"openai-responses",routeFingerprint:"a".repeat(64),recoveryMode:"known-response-id-retrieval"});
const base=process.env.MOVIE_MENTOR_ISOLATED_PROVIDER_URL;
const operationStore=createMovieMentorProviderOperationMongoStore();
const effectAuthority=createMovieMentorProviderEffectAuthority({store:createMovieMentorProviderEffectMongoStore(),requireEvidenceOperationBinding:true});
if(process.argv[2]==="--admit"||process.argv[2]==="--recover"){
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 try{
  if(process.argv[2]==="--admit"){
   const db=mongoose.connection.db;
   const now=new Date(),leaseExpiresAt=new Date(now.getTime()+120000);
   const call={providerCallId:callId,executionId,slotId:"semantic",task:"movie-mentor-semantic",leaseGeneration:1,leaseReference:"physical-lease",fencingToken:"physical-fence"};
   // Explicitly fixture-seeded execution; this court does NOT certify HTTP admission.
   await db.collection("movie_mentor_inference_execution").insertOne({domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId,phase:"active",ownerId:"physical-owner",leaseGeneration:1,leaseReference:call.leaseReference,fencingToken:call.fencingToken,leaseExpiresAt,providerCalls:[call],providerEffectRealityRevision:0});
   const operation=await operationStore.bindOperation({...call,providerTarget:target,providerModel:"gpt-isolated",boundAt:now.toISOString()});
   const admitted=await effectAuthority.beginDispatch({providerCall:{...call,dispatchAuthorized:true,projectId:"physical-project",principalId:"physical-principal",creatorTurnId:"physical-turn",reservationId:"physical-reservation",requestDigest:"physical-digest",ownerId:"physical-owner",admittedAt:now.toISOString()}});
   assert.equal(admitted.dispatchAuthorized,true);
   const post=await fetch(base+"/v1/responses",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operationId:callId})});
   assert.equal(post.status,200);
   const payload=await post.json();
   assert.equal(payload.id,responseId);
   const confirmed=await effectAuthority.contributeEvidence({providerCallId:callId,externalEffectId:payload.id,provider:"openai",source:"provider-response",providerOperation:operation});
   assert.equal(confirmed.state,"confirmed");
   assert.equal(confirmed.providerOperationBound,true);
   assert.equal((await db.collection("movie_mentor_inference_execution").findOne({executionId})).providerEffectRealityRevision,2);
   console.log("DURABLE_PROVIDER_EFFECT_CONFIRMED:"+payload.id);
   await new Promise(()=>{});
  }else{
   const effect=await effectAuthority.readReality(callId);
   assert.equal(effect.state,"confirmed");
   assert.deepEqual(effect.evidence.map(e=>e.externalEffectId),[responseId]);
   const db=mongoose.connection.db;
   const durableExecution=await db.collection("movie_mentor_inference_execution").findOne({executionId});
   assert.equal(durableExecution?.providerEffectRealityRevision,2);
   const proofInput={ownerId:"physical-owner",leaseGeneration:1,leaseReference:"physical-lease",fencingToken:"physical-fence"};
   let ownershipChecks=0;
   const verifyCurrentOwnership=async({operation,recoveryAuthority})=>{
    ownershipChecks++;
    const execution=await db.collection("movie_mentor_inference_execution").findOne({executionId:operation.executionId});
    const matched=execution?.phase==="active"&&execution?.ownerId===recoveryAuthority?.ownerId&&execution?.leaseGeneration===recoveryAuthority?.leaseGeneration&&execution?.leaseReference===recoveryAuthority?.leaseReference&&execution?.fencingToken===recoveryAuthority?.fencingToken&&execution?.providerCalls?.some(call=>call.providerCallId===operation.providerCallId);
    return matched?{authorized:true,currentRecoveryAuthorityVerified:true,transition:"provider-outcome-recovery",executionId:operation.executionId,providerCallId:operation.providerCallId,...proofInput}:{authorized:false,reason:"durable-execution-ownership-mismatch"};
   };
   let recoveryGets=0;
   const authority=createMovieMentorProviderOutcomeRecoveryAuthority({
    readProviderOperation:id=>operationStore.readOperation(id),
    readProviderEffectReality:id=>effectAuthority.readReality(id),
    resolveCurrentTarget:()=>target,
    requireRecoveryAuthority:true,
    assertCurrentRecoveryAuthority:verifyCurrentOwnership,
    recoverProviderResponse:async request=>{
     recoveryGets++;
     assert.equal(request.externalEffectId,responseId);
     assert.equal(request.providerCallId,callId);
     const result=await fetch(base+"/v1/responses/"+encodeURIComponent(request.externalEffectId));
     assert.equal(result.status,200);
     const payload=await result.json();
     assert.equal(payload.operationId,callId);
     return {provider:"openai",externalEffectId:payload.id,providerOperationId:callId,response:{id:payload.id,status:"completed",output_text:payload.output}};
    }
   });
   const denied=await authority.reconcile({providerCallId:callId,recoveryAuthority:{...proofInput,ownerId:"intruder"}});
   assert.equal(denied.recovered,false);
   assert.equal(denied.recoveryAuthorized,false);
   assert.equal(denied.reason,"provider-recovery-execution-fenced");
   assert.equal(recoveryGets,0,"intruder must not reach provider GET");
   const result=await authority.reconcile({providerCallId:callId,recoveryAuthority:proofInput});
   assert.equal(result.outcome,"CONFIRMED_EFFECT");
   assert.equal(result.recovered,true);
   assert.equal(result.redispatchAuthorized,false);
   assert.equal(result.externalEffectId,responseId);
   assert.equal(recoveryGets,1);
   assert.ok(ownershipChecks>=3,"ownership must be checked before and after provider I/O");
   // A real Mongo ownership change during historical provider I/O must fence
   // returned bytes, even when the provider GET itself succeeds.
   const revokedAuthority=createMovieMentorProviderOutcomeRecoveryAuthority({
    readProviderOperation:id=>operationStore.readOperation(id),
    readProviderEffectReality:id=>effectAuthority.readReality(id),
    resolveCurrentTarget:()=>target,
    requireRecoveryAuthority:true,
    assertCurrentRecoveryAuthority:verifyCurrentOwnership,
    recoverProviderResponse:async request=>{
     const reply=await fetch(base+"/v1/responses/"+encodeURIComponent(request.externalEffectId));
     assert.equal(reply.status,200);
     const historical=await reply.json();
     assert.equal(historical.id,responseId);
     const changed=await db.collection("movie_mentor_inference_execution").updateOne(
      {executionId,ownerId:proofInput.ownerId,leaseReference:proofInput.leaseReference,fencingToken:proofInput.fencingToken},
      {$set:{ownerId:"physical-takeover-owner",leaseGeneration:2,leaseReference:"physical-takeover-lease",fencingToken:"physical-takeover-fence"}}
     );
     assert.equal(changed.modifiedCount,1,"physical ownership takeover must persist before post-I/O fence");
     return {provider:"openai",externalEffectId:historical.id,providerOperationId:callId,response:{id:historical.id,status:"completed",output_text:historical.output}};
    }
   });
   await assert.rejects(
    revokedAuthority.reconcile({providerCallId:callId,recoveryAuthority:proofInput}),
    error=>error?.code==="MOVIE_MENTOR_PROVIDER_RECOVERY_POST_IO_AUTHORITY_REVOKED",
    "a real Mongo ownership takeover during provider GET must fence recovered bytes"
   );
   const takenOver=await db.collection("movie_mentor_inference_execution").findOne({executionId});
   assert.equal(takenOver.ownerId,"physical-takeover-owner");
   assert.equal((await effectAuthority.readReality(callId)).state,"confirmed");
   console.log("GREEN DURABLE_POST_IO_OWNERSHIP_REVOKED: Mongo takeover fenced returned historical response bytes");

   console.log("GREEN FRESH_PROCESS_DURABLE_CONFIRMED_EFFECT_RECOVERY");
  }
 }finally{await mongoose.disconnect();}
}else{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 try{
  const db=mongoose.connection.db;
  for(const name of ["movie_mentor_inference_execution","movie_mentor_provider_operation_reality","movie_mentor_provider_effect_reality"]){
   assert.equal(await db.collection(name).countDocuments({}),0,"isolated recovery fixture requires empty collection "+name);
  }
  await db.collection("movie_mentor_inference_execution").createIndex({executionId:1},{unique:true});
  await db.collection("movie_mentor_provider_operation_reality").createIndex({providerCallId:1},{unique:true});
  await db.collection("movie_mentor_provider_effect_reality").createIndex({providerCallId:1},{unique:true});
 }finally{await mongoose.disconnect();}
 let posts=0,gets=0;
 const records=new Map();
 const server=http.createServer(async(req,res)=>{
  res.setHeader("content-type","application/json");
  if(req.method==="POST"&&req.url==="/v1/responses"){
   let body="";for await(const part of req)body+=part;
   const input=JSON.parse(body);assert.equal(input.operationId,callId);
   posts++;const payload={id:responseId,operationId:callId,output:"original physical provider response"};
   records.set(payload.id,payload);res.writeHead(200);res.end(JSON.stringify(payload));return;
  }
  if(req.method==="GET"&&req.url==="/v1/responses/"+responseId){
   gets++;res.writeHead(200);res.end(JSON.stringify(records.get(responseId)));return;
  }
  res.writeHead(404);res.end(JSON.stringify({error:"missing"}));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const env={...process.env,MOVIE_MENTOR_ISOLATED_PROVIDER_URL:"http://127.0.0.1:"+server.address().port};
 const worker=spawn(process.execPath,[new URL(import.meta.url).pathname,"--admit"],{env,stdio:["ignore","pipe","pipe"]});
 let stdout="",stderr="";
 try{
  const observed=new Promise((resolve,reject)=>{
   worker.stdout.on("data",part=>{stdout+=part.toString();if(stdout.includes("DURABLE_PROVIDER_EFFECT_CONFIRMED:"+responseId))resolve();});
   worker.stderr.on("data",part=>stderr+=part.toString());
   worker.on("exit",(code,signal)=>reject(Error("admission worker ended before durable confirmation "+code+" "+signal+" "+stderr)));
  });
  await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error("durable confirmation timeout "+stdout+" "+stderr)),30000))]);
  assert.equal(posts,1);
  worker.kill("SIGKILL");
  const [code,signal]=await once(worker,"exit");assert.equal(code,null);assert.equal(signal,"SIGKILL");
  const fresh=spawn(process.execPath,[new URL(import.meta.url).pathname,"--recover"],{env,stdio:["ignore","pipe","pipe"]});
  let out="",err="";
  const done=new Promise((resolve,reject)=>{fresh.stdout.on("data",x=>out+=x.toString());fresh.stderr.on("data",x=>err+=x.toString());fresh.on("exit",(code)=>code===0?resolve():reject(Error("fresh recovery failed "+code+" "+out+" "+err)));});
  await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error("fresh recovery timeout "+out+" "+err)),30000))]);
  assert.match(out,/GREEN FRESH_PROCESS_DURABLE_CONFIRMED_EFFECT_RECOVERY/);
  assert.equal(posts,1,"recovery must not redispatch");
  assert.equal(gets,2,"one successful retrieval and one takeover-fenced retrieval; no redispatch");
  console.log("GREEN DURABLE_CONFIRMED_EFFECT_RECOVERY_PHYSICAL: real provider POST, transactional Mongo confirmation, SIGKILL, fresh-process GET and post-I/O Mongo takeover denial; one POST");
  console.log("LIMITATION: execution admission is fixture-seeded, ownership proof uses test-owned Mongo execution reader, and no canonical settlement performed.");
 }finally{if(worker.exitCode===null)worker.kill("SIGKILL");await new Promise(resolve=>server.close(resolve));}
}
