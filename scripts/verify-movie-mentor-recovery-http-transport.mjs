import assert from "node:assert/strict";
import express from "express";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

// Real HTTP request/response exercise with isolated injected authorities.
// Never connects to production MongoDB or invokes inference.
const state = {
  projectId:"film-one", revision:3, creatorStateGeneration:3,
  creatorConfirmedContext:[{kind:"title",value:"A Private Film"}],
  projectJourney:{phase:"completed"}, memoryContext:{notes:"secret scene"},
  creatorStateFingerprint:"fp", revisionAuthorityReference:"rev",
  creatorAuthorityReference:"creator", snapshotReference:"snapshot",
  internalSecret:"never-expose"
};
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
  readAuthoritativeState:async({projectId})=>{reads++;assert.equal(projectId,"film-one");return state;}
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
  console.log("Authenticated HTTP recovery route security and content passed.");
} finally {await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));}
