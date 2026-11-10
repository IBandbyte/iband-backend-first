import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import express from "express";
const source=readFileSync(new URL("../server.js",import.meta.url),"utf8");
const start=source.indexOf("let movieMentorReadOnlyRecoveryIngressMounted=false;");
const end=source.indexOf("await mountMovieMentorNativeProjectCreationIngress();",start);
assert.ok(start>=0&&end>start,"RED: server read-only mount source absent");
const app=express();
const mongo={connection:{readyState:0}};
let routeMounts=0;
const originalUse=app.use.bind(app);
app.use=(...args)=>{routeMounts++;return originalUse(...args);};
const auth={ready:true,getStatus:()=>({ready:true})};
const ownership={getStatus:()=>({ready:true})};
const ctx={
  mongoose:mongo,app,console:{log:()=>{}},
  createMovieMentorProductionAuthenticationComposition:()=>auth,
  authenticationCompositionProven:()=>true,
  movieMentorProjectOwnershipAuthority:ownership,ownershipAuthorityProven:()=>true,
  createMovieMentorCreatorStateAtomicCompositionFromMongoose:()=>({atomicCreatorStateReadiness:{}}),
  assertMovieMentorCreatorGatewayAtomicMountReadiness:async()=>{},
  createMovieMentorCreatorStateRecoveryProductionComposition:()=>({}),
  createMovieMentorCreatorStateReadExpressRouter:()=>{
    const router=express.Router();
    router.get("/state/recovery/:projectId",(req,res)=>res.json({success:true,projectId:req.params.projectId}));
    router.get("/projects/owned",(_req,res)=>res.json({success:true,projects:[]}));
    return router;
  },
  readAuthoritativeTurnSource:async()=>null,
};
runInNewContext(source.slice(start,end)+"\nthis.mount=mountMovieMentorReadOnlyRecoveryIngress;",ctx);
const server=app.listen(0,"127.0.0.1");
try{
  await new Promise(resolve=>server.once("listening",resolve));
  const base="http://127.0.0.1:"+server.address().port;
  const before=await fetch(base+"/api/movie-mentor/state/recovery/project-a");
  assert.equal(before.status,404,"RED: failed startup must leave HTTP recovery route unavailable");
  const denied=await ctx.mount();
  assert.equal(denied.mounted,false);
  assert.equal(routeMounts,0);
  mongo.connection.readyState=1;
  const [a,b]=await Promise.all([ctx.mount(),ctx.mount()]);
  assert.equal(a.mounted,true);assert.equal(b.mounted,true);
  assert.equal(routeMounts,1,"RED: concurrent recovery must mount one Express router");
  const after=await fetch(base+"/api/movie-mentor/state/recovery/project-a");
  assert.equal(after.status,200,"RED: recovered HTTP route must be reachable");
  assert.equal((await after.json()).projectId,"project-a");
  const owned=await fetch(base+"/api/movie-mentor/projects/owned");
  assert.equal(owned.status,200,"RED: recovered owned-project route must be reachable");
  await ctx.mount();
  assert.equal(routeMounts,1);
  console.log("GREEN RUNTIME HTTP: initially unavailable Express routes become reachable after concurrent read-only remount, with one registration");
}finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
