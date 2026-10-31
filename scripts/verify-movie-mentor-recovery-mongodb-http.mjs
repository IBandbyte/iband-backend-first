import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { readAuthoritativeTurnSource } from "../ai/MovieMentorCreatorStateStore.js";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

// Isolated CI MongoDB physical persistence and real HTTP recovery; no production writes.
assert.match(process.env.MONGO_URI||"",/^mongodb:\/\/127\.0\.0\.1:27017\/movie_mentor_recovery_ci$/,"Only the isolated CI MongoDB URI is permitted");
const state = {
  projectId:"film-one", revision:3, creatorStateGeneration:3,
  creatorConfirmedContext:[{kind:"title",value:"A Private Film"}],
  projectJourney:{phase:"completed"}, memoryContext:{notes:"secret scene"},
  creatorStateFingerprint:"fp", revisionAuthorityReference:"rev",
  creatorAuthorityReference:"creator", snapshotReference:"snapshot",
  internalSecret:"never-expose"
};
await mongoose.connect(process.env.MONGO_URI);
const collection=mongoose.connection.db.collection("movie_mentor_creator_state");
await collection.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
await collection.insertOne({...state,capturedAt:new Date(),creatorSessionId:"old-browser-session"});
await mongoose.disconnect();
await mongoose.connect(process.env.MONGO_URI);
let reads=0;
const requestAuthority={async authorize({request,projectId}){
  const token=request.headers.authorization?.replace(/^Bearer /,"");
  if(!token) throw Object.assign(new Error("Credentials required"),{code:"MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED"});
  if(token!=="owner"||projectId!=="film-one") throw Object.assign(new Error("Owner mismatch"),{code:"MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED"});
  return {authorized:true,projectId,principalId:token,ownershipRef:"owner-proof"};
}};
const spend={reserveTurn(){},readReservation(){}};
const execution=Object.fromEntries(["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"].map(k=>[k,()=>{}]));
const settlement={reconcile(){},releaseUnclaimed(){},releaseUnbound(){},readSettlement(){},reserveSettlement(){},assertSettlement(){},commitSettlement(){}};
const app=express();
app.use(express.json());
app.use("/api/movie-mentor",createMovieMentorTurnRouter({
  requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,
  inferenceSettlementAuthority:settlement,
  readAuthoritativeState:async({projectId})=>{reads++;return readAuthoritativeTurnSource({projectId});}
}));
const server=app.listen(0,"127.0.0.1");
try {
  await new Promise(resolve=>server.once("listening",resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/movie-mentor/state/recovery/`;
  const call=async(path,token)=>{const res=await fetch(base+path,{headers:token?{authorization:`Bearer ${token}`}:{}});return{status:res.status,body:await res.json()};};
  const missing=await call("film-one");assert.equal(missing.status,401);
  const stranger=await call("film-one","stranger");assert.equal(stranger.status,403);
  const cross=await call("film-two","owner");assert.equal(cross.status,403);
  assert.equal(reads,0,"Denied HTTP requests must not read private state");
  const owner=await call("film-one","owner");assert.equal(owner.status,200);
  assert.equal(owner.body.state.revision,3);
  assert.deepEqual(owner.body.state.projectJourney,state.projectJourney);
  assert.deepEqual(owner.body.state.memoryContext,state.memoryContext);
  assert.equal(owner.body.state.internalSecret,undefined);
  assert.equal(reads,1);
  assert.equal(owner.body.state.creatorSessionId,undefined);
  const indexes=await collection.indexes();assert(indexes.some(i=>i.unique&&i.key?.projectId===1));
  console.log("GREEN: isolated MongoDB saved state survived reconnection and was recovered over authenticated HTTP.");
} finally {await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));await mongoose.disconnect();}
