import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {once} from "node:events";
import mongoose from "mongoose";
import {createMovieMentorProviderOperationMongoStore} from "../ai/MovieMentorProviderOperationMongoStore.js";
import {createMovieMentorProviderOutcomeRecoveryAuthority} from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";
import {describeCurrentMovieMentorProviderTarget} from "../ai/MovieMentorProviderTargetAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.equal(uri,"mongodb://127.0.0.1:27017/movie_mentor_interruption_recovery?replicaSet=rs0&directConnection=true","refuse non-disposable Mongo");
process.env.MONGO_URI=uri;
const names=["movie_mentor_inference_execution","movie_mentor_provider_operation_reality","movie_mentor_provider_effect_reality","movie_mentor_inference_spend_reservation","movie_mentor_inference_entitlement","movie_mentor_canonical_result"];
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 if(process.argv[2]==="--fresh-recovery"){
  const id=process.argv[3];
  assert.match(id||"",/^provider-call-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,"fresh worker requires production-generated provider-call UUID");
  const store=createMovieMentorProviderOperationMongoStore();
  const operation=await store.readOperation(id);
  assert.equal(operation?.providerCallId,id);
  let providerRecoveryCalls=0;
  const authority=createMovieMentorProviderOutcomeRecoveryAuthority({
   readProviderOperation:key=>store.readOperation(key),
   readProviderEffectReality:key=>db.collection("movie_mentor_provider_effect_reality").findOne({providerCallId:key}),
   recoverProviderResponse:async()=>{providerRecoveryCalls++;throw Error("unknown provider result must not trigger recovery network");},
   resolveCurrentTarget:()=>describeCurrentMovieMentorProviderTarget()
  });
  const outcome=await authority.reconcile({providerCallId:id});
  assert.equal(outcome.outcome,"STILL_UNKNOWN");
  assert.equal(outcome.redispatchAuthorized,false);
  assert.equal(outcome.refundAuthorized,false);
  assert.equal(outcome.recoveryAuthorized,false);
  assert.equal(providerRecoveryCalls,0);
  console.log("GREEN fresh-process production-origin provider UNKNOWN denial");
 }else{
  for(const name of names)assert.equal(await db.collection(name).countDocuments({}),0,"interruption court requires clean disposable "+name);
  const child=spawn(process.execPath,["scripts/verify-movie-mentor-http-origin-interruption-child.mjs"],{
   env:{...process.env,MOVIE_MENTOR_INTERRUPT_FIRST_PROVIDER:"1"},stdio:["ignore","pipe","pipe"]
  });
  let stdout="",stderr="",observed=false;
  const marker="PHYSICAL_ORIGIN_PROVIDER_SOCKET_RECEIVED_FIRST_POST";
  const waitForMarker=new Promise((resolve,reject)=>{
   child.stdout.on("data",chunk=>{stdout+=chunk.toString();if(!observed&&stdout.includes(marker)){observed=true;resolve();}});
   child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
   child.on("exit",(code,signal)=>{if(!observed)reject(Error("origin worker exited before provider POST: "+code+" "+signal+" "+stdout+" "+stderr));});
  });
  try{
   await Promise.race([waitForMarker,new Promise((_,reject)=>setTimeout(()=>reject(Error("origin provider POST timeout: "+stdout+" "+stderr)),30000))]);
   assert.equal(child.exitCode,null,"origin HTTP worker must be live at interruption");
   child.kill("SIGKILL");
   const [code,signal]=await once(child,"exit");
   assert.equal(code,null);assert.equal(signal,"SIGKILL");
   const execution=await db.collection(names[0]).findOne({});
   const operation=await db.collection(names[1]).findOne({});
   const reservation=await db.collection(names[3]).findOne({});
   const entitlement=await db.collection(names[4]).findOne({});
   assert.ok(execution?.executionId,"production-origin execution must exist");
   assert.ok(operation?.providerCallId,"production-origin provider operation must exist");
   assert.equal(operation.executionId,execution.executionId);
   assert.equal(reservation?.status,"reserved","unknown in-flight provider must not consume/refund reservation");
   assert.equal(entitlement?.consumedUnits,0);
   assert.equal(await db.collection(names[5]).countDocuments({}),0,"no canonical result may be fabricated");
   const before=await Promise.all(names.map(async name=>[name,await db.collection(name).find({}).project({_id:0}).toArray()]));
   console.log("GREEN signed HTTP-origin provider POST observed before worker SIGKILL; durable operation="+operation.providerCallId);
   const fresh=spawnSync(process.execPath,[new URL(import.meta.url).pathname,"--fresh-recovery",operation.providerCallId],{encoding:"utf8",env:{...process.env},timeout:30000});
   assert.equal(fresh.status,0,fresh.stderr+" "+fresh.stdout);
   assert.match(fresh.stdout,/GREEN fresh-process production-origin provider UNKNOWN denial/);
   const after=await Promise.all(names.map(async name=>[name,await db.collection(name).find({}).project({_id:0}).toArray()]));
   assert.deepEqual(after,before,"fresh recovery must not mutate execution, provider, spend or canonical ledgers");
   console.log("GREEN physical HTTP-origin interruption: real signed ingress, production-composed admission, provider POST, SIGKILL, fresh-process UNKNOWN denial, unchanged durable ledgers");
   console.log("LIMITATION: local synthetic JWT signing and local provider; full resumed settlement after interrupted UNKNOWN is not certified.");
  }finally{if(child.exitCode===null)child.kill("SIGKILL");}
 }
}finally{await mongoose.disconnect();}
