import assert from "node:assert/strict";
import http from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {once} from "node:events";
import mongoose from "mongoose";
import {createMovieMentorProviderOperationMongoStore} from "../ai/MovieMentorProviderOperationMongoStore.js";
import {describeCurrentMovieMentorProviderTarget} from "../ai/MovieMentorProviderTargetAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:27017\/movie_mentor_interruption_recovery\?replicaSet=rs0&directConnection=true$/,"refuse non-disposable Mongo");
process.env.MONGO_URI=uri;
const id="restart-unknown-"+process.pid+"-"+Date.now();
const executionId=id+"-execution";
const names=["movie_mentor_inference_execution","movie_mentor_provider_operation_reality","movie_mentor_provider_effect_reality","movie_mentor_inference_spend_reservation","movie_mentor_inference_entitlement"];
if(process.argv[2]==="--socket-worker"){
 const port=Number(process.argv[3]);
 assert.ok(Number.isInteger(port)&&port>0);
 await new Promise((resolve,reject)=>{
  const req=http.request({hostname:"127.0.0.1",port,path:"/v1/responses",method:"POST",headers:{"content-type":"application/json"}},res=>{res.resume();res.on("end",resolve);});
  req.on("error",reject);
  req.end(JSON.stringify({providerCallId:process.argv[4]}));
 });
 process.exit(2);
}
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
let server,child;
try{
 const db=mongoose.connection.db;
 const hello=await db.admin().command({hello:1});
 assert.equal(hello.setName,"rs0");
 for(const name of [names[0],names[1],names[2]])await db.collection(name).createIndex({providerCallId:1},{unique:true,sparse:true});
 await db.collection(names[0]).insertOne({executionId,providerCalls:[{providerCallId:id,executionId,slotId:"semantic",task:"movie-mentor-semantic",state:"admitted"}],ownerId:"worker-A",leaseGeneration:1,phase:"active"});
 const store=createMovieMentorProviderOperationMongoStore();
 await store.bindOperation({providerCallId:id,executionId,slotId:"semantic",task:"movie-mentor-semantic",providerTarget:describeCurrentMovieMentorProviderTarget(),providerModel:"gpt-test",boundAt:new Date().toISOString()});
 await db.collection(names[2]).insertOne({providerCallId:id,executionId,slotId:"semantic",task:"movie-mentor-semantic",state:"unknown",evidence:[],dispatchUnknownAt:new Date(),revision:1});
 const before=await Promise.all(names.map(async name=>[name,await db.collection(name).find({}).project({_id:0}).toArray()]));
 let requestSeen;
 const seen=new Promise(resolve=>{requestSeen=resolve;});
 server=http.createServer(async(req,res)=>{
  let body="";for await(const chunk of req)body+=chunk;
  assert.equal(req.method,"POST");assert.equal(req.url,"/v1/responses");
  assert.equal(JSON.parse(body).providerCallId,id);
  requestSeen();
  // Intentionally hold provider response until the caller has been killed.
  req.on("close",()=>{if(!res.writableEnded)res.destroy();});
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 child=spawn(process.execPath,[new URL(import.meta.url).pathname,"--socket-worker",String(server.address().port),id],{env:{...process.env},stdio:"ignore"});
 await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error("physical provider socket not observed")),10000))]);
 assert.equal(child.exitCode,null,"provider request must still be in flight");
 child.kill("SIGKILL");
 const [code,signal]=await once(child,"exit");
 assert.equal(signal,"SIGKILL");assert.equal(code,null);
 console.log("GREEN physical provider socket received real POST before worker SIGKILL");
 const worker=spawnSync(process.execPath,["scripts/verify-movie-mentor-provider-durable-restart-unknown.mjs","--recovered-worker",id],{encoding:"utf8",env:{...process.env},timeout:30000});
 assert.equal(worker.status,0,worker.stderr+" "+worker.stdout);
 assert.match(worker.stdout,/fresh-worker durable UNKNOWN denial GREEN/);
 const after=await Promise.all(names.map(async name=>[name,await db.collection(name).find({}).project({_id:0}).toArray()]));
 assert.deepEqual(after,before,"socket loss and recovery must not change durable ledgers or redispatch");
 console.log("GREEN physical socket interruption baseline: provider POST observed, worker SIGKILL, fresh-process UNKNOWN denial, durable ledgers unchanged");
 console.log("LIMITATION: provider admission and UNKNOWN records are preseeded; this does not certify production signed-HTTP admission or full HTTP settlement recovery.");
}finally{
 if(child&&child.exitCode===null)child.kill("SIGKILL");
 if(server)await new Promise(resolve=>server.close(resolve));
 await mongoose.disconnect();
}
