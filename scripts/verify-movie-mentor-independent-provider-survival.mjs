import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
import {once} from "node:events";

// Isolated transport topology court only. It does not certify Mongo effect
// confirmation, production HTTP admission, reconstruction, or settlement.
if(process.argv[2]==="--worker"){
 const base=process.env.MOVIE_MENTOR_ISOLATED_PROVIDER_URL;
 assert.match(base||"",/^http:\/\/127\.0\.0\.1:\d+$/);
 const response=await fetch(base+"/v1/responses",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({operationId:"isolated-operation-1"})
 });
 assert.equal(response.status,200);
 const payload=await response.json();
 assert.equal(payload.id,"isolated-response-1");
 console.log("INDEPENDENT_PROVIDER_WORKER_RECEIVED_ID:"+payload.id);
 // Worker must remain alive until the parent SIGKILLs it.
 await new Promise(()=>{});
}else{
 const records=new Map();
 let posts=0,gets=0;
 const provider=http.createServer(async(req,res)=>{
  let body="";for await(const chunk of req)body+=chunk;
  res.setHeader("content-type","application/json");
  if(req.method==="POST"&&req.url==="/v1/responses"){
   const input=JSON.parse(body);
   assert.equal(input.operationId,"isolated-operation-1");
   posts++;
   const response={id:"isolated-response-1",operationId:input.operationId,output:"original-provider-result"};
   records.set(response.id,response);
   res.writeHead(200);res.end(JSON.stringify(response));return;
  }
  if(req.method==="GET"&&req.url==="/v1/responses/isolated-response-1"){
   gets++;const response=records.get("isolated-response-1");
   res.writeHead(response?200:404);res.end(JSON.stringify(response||{error:"missing"}));return;
  }
  res.writeHead(404);res.end(JSON.stringify({error:"unsupported"}));
 });
 await new Promise(resolve=>provider.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+provider.address().port;
 const child=spawn(process.execPath,[new URL(import.meta.url).pathname,"--worker"],{
  env:{...process.env,MOVIE_MENTOR_ISOLATED_PROVIDER_URL:url},
  stdio:["ignore","pipe","pipe"]
 });
 let stdout="",stderr="";
 try{
  const observed=new Promise((resolve,reject)=>{
   child.stdout.on("data",chunk=>{
    stdout+=chunk.toString();
    if(stdout.includes("INDEPENDENT_PROVIDER_WORKER_RECEIVED_ID:isolated-response-1"))resolve();
   });
   child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
   child.on("exit",(code,signal)=>reject(Error("worker exited before provider response: "+code+" "+signal+" "+stderr)));
  });
  await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error("worker provider response timeout: "+stdout+" "+stderr)),15000))]);
  assert.equal(posts,1);
  assert.equal(child.exitCode,null);
  child.kill("SIGKILL");
  const [code,signal]=await once(child,"exit");
  assert.equal(code,null);assert.equal(signal,"SIGKILL");
  // Provider lives in the supervisor, not the killed worker.
  assert.equal(provider.listening,true);
  const retrieved=await fetch(url+"/v1/responses/isolated-response-1");
  assert.equal(retrieved.status,200);
  assert.deepEqual(await retrieved.json(),{id:"isolated-response-1",operationId:"isolated-operation-1",output:"original-provider-result"});
  // A caller cannot replace the confirmed response ID with an invented one.
  const fabricated=await fetch(url+"/v1/responses/fabricated-response-id");
  assert.equal(fabricated.status,404,"unrecognized response ID must fail closed");
  assert.deepEqual(await fabricated.json(),{error:"unsupported"});
  assert.equal(posts,1,"fabricated historical retrieval must not redispatch");
  assert.equal(posts,1,"recovery GET must not create another provider POST");
  assert.equal(gets,1);
  console.log("GREEN INDEPENDENT_PROVIDER_SURVIVES_SIGKILL: original response ID retrieved after worker termination; provider POST count remains one");
  console.log("LIMITATION: transport topology only; no durable effect confirmation, production recovery authority, reconstruction, finalization or settlement certified.");
 }finally{
  if(child.exitCode===null)child.kill("SIGKILL");
  await new Promise(resolve=>provider.close(resolve));
 }
}
