import assert from "node:assert/strict";
import {generateKeyPairSync,createSign} from "node:crypto";
import mongoose from "mongoose";
import express from "express";
import {createServer} from "node:http";
import {once} from "node:events";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {createMovieMentorProductionAuthenticationComposition,isMovieMentorProductionAuthenticationOwnerProof} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorCreatorRequestAuthority} from "../ai/MovieMentorCreatorRequestAuthority.js";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";

// Isolated real Clerk verifier + real durable Mongo ownership authority.
// Locally generated RS256 JWTs: NOT live Clerk sessions or production credentials.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri),"Disposable localhost Mongo required");
process.env.MONGO_URI=uri;
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const pem=publicKey.export({type:"spki",format:"pem"});
const issuer="https://isolated-clerk.example.test",audience="movie-mentor-isolated",party="https://isolated-client.example.test";
const auth=createMovieMentorProductionAuthenticationComposition({env:{
 MOVIE_MENTOR_CLERK_JWT_KEY:pem,
 MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([party]),
 MOVIE_MENTOR_CLERK_ISSUER:issuer,
 MOVIE_MENTOR_AUDIENCE:audience
}});
assert.equal(auth.ready,true);
assert.equal(isMovieMentorProductionAuthenticationOwnerProof(auth,auth.status),true);
const token=(sub,extra={})=>{
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"isolated-key"})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({sub,iss:issuer,aud:audience,azp:party,sid:"isolated-session-"+sub,iat:now-10,nbf:now-10,exp:now+300,...extra})).toString("base64url");
 const signature=createSign("RSA-SHA256").update(header+"."+payload).end().sign(privateKey).toString("base64url");
 return header+"."+payload+"."+signature;
};
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const coll=mongoose.connection.db.collection("movie_mentor_project_ownership");
 await coll.createIndex({projectId:1},{unique:true});
 await coll.createIndex({establishmentAuthorityId:1},{unique:true});
 const projectId="physical-auth-owner-"+Date.now();
 await coll.insertOne({domain:"iband.movie-mentor.project-ownership",schema:1,projectId,ownerPrincipalId:"isolated-owner",ownershipRevision:1,ownershipReference:"isolated-owner-reference",establishmentAuthorityId:"isolated-establishment-"+projectId,establishmentSource:"isolated-physical-verifier",status:"active",establishedAt:new Date()});
 const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
 const requestAuthority=createMovieMentorCreatorRequestAuthority({verifyCredential:auth.verifyCredential,expectedIssuer:auth.expectedIssuer,expectedAudience:auth.expectedAudience,ownershipAuthority});
 const authorize=async t=>requestAuthority.authorize({request:{headers:{authorization:"Bearer "+t}},projectId});
 let runtimeCalls=0, readinessCalls=0;
 const forbidden=name=>async()=>{throw Error("unexpected authority execution: "+name);};
 const methods=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
 const execution=Object.fromEntries(methods.map(n=>[n,forbidden(n)]));
 const spend={reserveTurn:forbidden("reserveTurn"),readReservation:forbidden("readReservation")};
 const settlement={reconcile:forbidden("reconcile"),releaseUnclaimed:forbidden("releaseUnclaimed"),releaseUnbound:forbidden("releaseUnbound")};
 const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,requireAtomicCreatorStateOperation:true,atomicCreatorStateReadiness:async()=>{readinessCalls++;throw Error("unauthorized reached atomic readiness");},runTurn:async()=>{runtimeCalls++;throw Error("unauthorized reached runtime");}});
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 const server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
 try{
  const base="http://127.0.0.1:"+server.address().port+"/api/movie-mentor/turn";
  for(const [name,credential] of [["missing",null],["non-owner",token("intruder")],["tampered",(()=>{const x=token("isolated-owner").split(".");x[1]=Buffer.from(JSON.stringify({sub:"isolated-owner",iss:issuer,aud:audience})).toString("base64url");return x.join(".")})()],["expired",token("isolated-owner",{exp:Math.floor(Date.now()/1000)-30})]]){
   const response=await fetch(base,{method:"POST",headers:{"content-type":"application/json",...(credential?{authorization:"Bearer "+credential}:{})},body:JSON.stringify({projectId})});
   assert.notEqual(response.status,200,name+" must fail closed");
   const body=await response.json();assert.equal(body.success,false,name+" response must be denial");
   console.log("GREEN REAL HTTP /turn DENIAL:",name);
  }
  assert.equal(runtimeCalls,0);assert.equal(readinessCalls,0);
  assert.equal(await coll.countDocuments({projectId}),1);
  console.log("GREEN REAL HTTP /turn: unauthorized requests cannot reach atomic readiness or inference runtime");
  console.log("LIMITATION: production Clerk verifier and durable ownership with local JWTs; negative ingress only, no authorized /turn execution, provider settlement or final exposure.");
 }finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
 const granted=await authorize(token("isolated-owner"));
 assert.equal(granted.authorized,true);assert.equal(granted.principalId,"isolated-owner");assert.equal(granted.projectId,projectId);
 console.log("GREEN REAL AUTH A: locally signed RS256 token verified by production Clerk verifier and real Mongo owner matched");
 await assert.rejects(authorize(token("intruder")));
 console.log("GREEN REAL AUTH B: valid RS256 credential for non-owner denied by durable project ownership");
 const tampered=token("isolated-owner").split(".");tampered[1]=Buffer.from(JSON.stringify({sub:"isolated-owner",iss:issuer,aud:audience,iat:1,exp:9999999999})).toString("base64url");
 await assert.rejects(authorize(tampered.join(".")));
 console.log("GREEN REAL AUTH C: tampered JWT signature denied");
 await assert.rejects(authorize(token("isolated-owner",{exp:Math.floor(Date.now()/1000)-30})));
 console.log("GREEN REAL AUTH D: expired JWT denied");
 assert.equal(await coll.countDocuments({projectId}),1);
 console.log("LIMITATION: locally signed JWTs, real production verifier and Mongo ownership registry; no live Clerk session or successful /turn journey.");
}finally{await mongoose.disconnect();}
