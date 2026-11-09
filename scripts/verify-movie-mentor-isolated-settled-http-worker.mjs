import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { createMovieMentorProductionAuthenticationComposition } from "../ai/MovieMentorProductionAuthenticationComposition.js";
import { createMovieMentorCreatorRequestAuthority } from "../ai/MovieMentorCreatorRequestAuthority.js";
import { createMovieMentorProjectOwnershipAuthority } from "../ai/MovieMentorProjectOwnershipRegistry.js";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorCanonicalResultAuthority } from "../ai/MovieMentorCanonicalResultAuthority.js";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";
import { createMovieMentorInferenceExecutionClosureAuthority } from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//);
assert.match(uri,/replicaSet=/);
const [executionId,principalId,projectId,creatorTurnId,creatorMessage]=process.argv.slice(2);
assert.ok(executionId&&principalId&&projectId&&creatorTurnId&&creatorMessage);
process.env.MONGO_URI=uri;
const issuer="https://isolated-clerk.example.test",audience="isolated-movie-mentor",party="https://isolated-app.example.test";
const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const publicPem=publicKey.export({type:"spki",format:"pem"});
const authentication=createMovieMentorProductionAuthenticationComposition({env:{
 MOVIE_MENTOR_CLERK_JWT_KEY:publicPem,
 MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([party]),
 MOVIE_MENTOR_CLERK_ISSUER:issuer,MOVIE_MENTOR_AUDIENCE:audience
}});
assert.equal(authentication.ready,true);
function jwt(subject){
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"isolated-key"})).toString("base64url");
 const payload=Buffer.from(JSON.stringify({sub:subject,iss:issuer,aud:audience,azp:party,sid:"isolated-replay-session",iat:now-10,nbf:now-10,exp:now+300})).toString("base64url");
 const input=`${header}.${payload}`;
 return `${input}.${crypto.sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url")}`;
}
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
let server;
try{
 const db=mongoose.connection.db;
 const reservations=db.collection("movie_mentor_inference_spend_reservation");
 const entitlements=db.collection("movie_mentor_inference_entitlement");
 const beforeReservation=await reservations.findOne({principalId});
 const beforeEntitlement=await entitlements.findOne({principalId});
 assert.equal(beforeReservation.status,"consumed");
 assert.equal(beforeEntitlement.consumedUnits,1);
 const ownershipAuthority=createMovieMentorProjectOwnershipAuthority();
 const requestAuthority=createMovieMentorCreatorRequestAuthority({
  verifyCredential:authentication.verifyCredential,expectedIssuer:authentication.expectedIssuer,
  expectedAudience:authentication.expectedAudience,ownershipAuthority
 });
 const spend=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(spend.ready,true);
 const closure=createMovieMentorInferenceExecutionClosureAuthority({
  store:createMovieMentorInferenceExecutionMongoStore(),effectStore:createMovieMentorProviderEffectMongoStore()
 });
 const canonical=createMovieMentorCanonicalResultAuthority({
  store:createMovieMentorCanonicalResultMongoStore(),
  assertCurrentClosure:closure.assertCurrentClosure,
  readResultCandidate:createMovieMentorResultCandidateMongoStore().readByExecution
 });
 const settlement=createMovieMentorInferenceSettlementReconciliationAuthority({store:createMovieMentorInferenceSettlementMongoStore()});
 let replayCalls=0;
 const methods=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
 const execution=Object.fromEntries(methods.map(key=>[key,async()=>{throw Error(`unexpected execution operation: ${key}`)}]));
 execution.readCanonicalResult=canonical.readResult;
 const router=createMovieMentorTurnRouter({
  requestAuthority,inferenceSpendAuthority:spend.authority,
  inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
  runTurn:async()=>{
   replayCalls++;
   const current=await canonical.readResult({executionId});
   assert.equal(current.authorized,true);
   const reconciled=await settlement.reconcile({executionId});
   assert.equal(reconciled.authorized,true);
   assert.equal(reconciled.settled,true);
   return {...current.resultPayload,metadata:{...current.resultPayload.metadata,canonicalResult:{
    creatorResponseAuthorityVerified:true,executionId,
    resultReference:current.resultReference,candidateReference:current.candidateReference,
    resultDigest:current.resultDigest,reservationId:current.reservationId,
    closureCertificateDigest:current.closureCertificateDigest
   }}};
  }
 });
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
 const url=`http://127.0.0.1:${server.address().port}/api/movie-mentor/turn`;
 async function post(subject){
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${jwt(subject)}`},
   body:JSON.stringify({projectId,creatorTurnId,message:creatorMessage,options:{}})});
  return {status:response.status,body:await response.json()};
 }
 const intruder=await post("isolated-intruder");
 assert.equal(intruder.status,403);
 assert.equal(replayCalls,0);
 const owner=await post(principalId);
 assert.equal(owner.status,200,JSON.stringify(owner.body));
 assert.equal(owner.body.status,"complete");
 assert.equal(owner.body.metadata.canonicalResult.replayedFromDurableResult,undefined);
 assert.equal(replayCalls,1);
 const again=await post(principalId);
 assert.equal(again.status,200);
 assert.equal(replayCalls,2);
 assert.deepEqual(await reservations.findOne({principalId}),beforeReservation);
 assert.deepEqual(await entitlements.findOne({principalId}),beforeEntitlement);
 assert.equal(await db.collection("movie_mentor_canonical_result").countDocuments({executionId}),1);
 console.log("GREEN fresh-process real signed-JWT HTTP owner replay and non-owner denial, canonical exposure gate and immutable financial ledgers");
 console.log("LIMITATION: injected read-only replay adapter; production forward execution runtime and provider dispatch path not certified by this HTTP court.");
}finally{
 if(server)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 await mongoose.disconnect();
}
