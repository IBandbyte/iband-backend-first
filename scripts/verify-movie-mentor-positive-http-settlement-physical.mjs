import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  runTurn:async(body,deps)=>runMovieMentorTurnWithForwardExecutionAuthority(body,{
   ...deps,readAuthoritativeTurnSource,orchestrateTurn:orchestrateMovieMentorTurn,
   createExecutionOwnerId:()=>`${prefix}-http-owner`
  })
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
  console.log(`PHYSICAL POSITIVE DURABLE CHECKPOINT: execution=${actualExecution?.executionId||"none"} phase=${actualExecution?.phase||"none"} reservation=${actualReservation?.status||"none"}`);
  assert.notEqual(response.status,200,"positive HTTP cannot claim completion without proven canonical finalization, settlement and replay");
 }finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }

 console.error("RED POSITIVE_HTTP_SETTLEMENT_JOURNEY_NOT_IMPLEMENTED: genuine HTTP runtime attempted; full positive provider response, canonical settlement and fresh-process replay remain uncertified.");
 process.exitCode=1;
}finally{
 await mongoose.disconnect();
}
