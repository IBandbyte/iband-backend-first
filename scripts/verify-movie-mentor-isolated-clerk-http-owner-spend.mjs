import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorRequestAuthority } from "../ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorProjectOwnershipAuthority } from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//);
assert.match(uri,/replicaSet=/);
process.env.MONGO_URI=uri;
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
let server;
try{
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
 let runCalls=0;
 const executionMethods=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
 const execution=Object.fromEntries(executionMethods.map(key=>[key,async()=>{throw Error(`unexpected execution: ${key}`)}]));
 const settlement={reconcile:async()=>{throw Error("unexpected settlement");},releaseUnclaimed:async()=>{throw Error("unexpected release");},releaseUnbound:async()=>{throw Error("unexpected release");}};
 const router=createMovieMentorTurnRouter({requestAuthority,inferenceSpendAuthority:spend.authority,
  inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
  runTurn:async(_body,{serverAuthority})=>{
   runCalls++;
   const reserved=await spend.authority.reserveTurn({serverAuthority,projectId:serverAuthority.projectId});
   assert.equal(reserved.authorized,true);
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
 const after=await entitlement.findOne({principalId});
 assert.equal(after.remainingUnits,0);assert.equal(after.reservedUnits,1);
 assert.equal(await db.collection("movie_mentor_inference_spend_reservation").countDocuments({principalId}),1);
 console.log("GREEN real signed RS256 Clerk-verifier JWT over HTTP + durable owner authorization");
 console.log("GREEN missing, tampered and non-owner HTTP credentials denied before spend");
 console.log("GREEN owner HTTP ingress -> production-composed durable spend reservation");
 console.log("LIMITATION: locally generated isolated RSA test keys and native ownership fixture; full production turn/settlement HTTP journey not certified.");
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await mongoose.disconnect();
}
