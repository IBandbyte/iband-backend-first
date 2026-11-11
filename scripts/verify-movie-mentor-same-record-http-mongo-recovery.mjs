import assert from "node:assert/strict";
import {generateKeyPairSync,createSign} from "node:crypto";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorCreatorStateRecoveryExpressRouter} from "../ai/MovieMentorCreatorStateRecoveryExpressRouter.js";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";
import {readAuthoritativeTurnSource} from "../ai/MovieMentorCreatorStateStore.js";
import express from "express";
import mongoose from "mongoose";
import {createServer} from "node:http";
import {once} from "node:events";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {createMovieMentorCreatorStateAtomicCompositionFromMongoose} from "../ai/MovieMentorCreatorStateAtomicComposition.js";

// Physical disposable Mongo + real loopback HTTP + real creator-state atomic adapter.
// Injected request authority and state-transition seam; NOT a live identity provider,
// complete production /turn inference journey, or disposition of the original RED.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri),"Disposable localhost Mongo URI required");
const barrier=()=>{let enter,release;return{reached:new Promise(r=>enter=r),held:new Promise(r=>release=r),enter:()=>enter(),release:()=>release()};};
const project=id=>"http-mongo-"+id;
const proposed=id=>({projectId:project(id),revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-"+id,revisionAuthorityReference:"revision-"+id,creatorAuthorityReference:"authority-"+id,snapshotReference:"snapshot-"+id,capturedAt:new Date("2026-11-07T00:00:00Z")});
const envelope=id=>({projectId:project(id),principalId:"owner",operationId:"operation-"+id,source:"creator-memory",expectedRevision:0,requestDigest:"digest-"+id});
const executionNames=["findExecutionByCreatorTurn","openExecution","acquireExecution","assertFence","claimProviderCall","beginProviderDispatch","assertProviderDispatch","contributeProviderEffectEvidence","stageResultCandidate","readResultCandidate","beginExecutionClosing","reconcileExecutionClosure","assertCurrentExecutionClosure","commitCanonicalResult","readCanonicalResult"];
const forbidden=name=>async()=>{throw Error("Unexpected inference path: "+name);};
const execution=Object.fromEntries(executionNames.map(n=>[n,forbidden(n)]));
const spend={reserveTurn:forbidden("reserveTurn"),readReservation:forbidden("readReservation")};
const settlement={reconcile:forbidden("reconcile"),releaseUnclaimed:forbidden("releaseUnclaimed"),releaseUnbound:forbidden("releaseUnbound")};
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
let server;
try{
 const db=mongoose.connection.db;
 const states=db.collection("movie_mentor_creator_state"),operations=db.collection("movie_mentor_creator_state_operations"),ownerships=db.collection("movie_mentor_project_ownership");
 await states.createIndex({projectId:1},{unique:true});
 await operations.createIndex({projectId:1,principalId:1,operationId:1},{unique:true});
 await ownerships.createIndex({projectId:1},{unique:true});
 await ownerships.createIndex({establishmentAuthorityId:1},{unique:true});
 const composition=createMovieMentorCreatorStateAtomicCompositionFromMongoose(mongoose.connection);
 const credential={revoked:false},gate=barrier();
 const requestAuthority={async authorize({request,projectId:requested}) {
  if(request.headers.authorization!=="Bearer isolated-valid"||credential.revoked){const e=Error("Credential revoked");e.code="MOVIE_MENTOR_AUTH_REVOKED";throw e;}
  return{authorized:true,principalId:"owner",projectId:requested,ownershipRef:"ownership-"+requested,ownershipRevision:1};
 }};
 const router=createMovieMentorTurnRouter({
  requestAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:execution,inferenceSettlementAuthority:settlement,
  atomicCreatorStateReadiness:composition.atomicCreatorStateReadiness,requireAtomicCreatorStateOperation:true,
  applyStateTransition:async(body,deps)=>{
   if(body.projectId===project("revoked-after-admission")){gate.enter();await gate.held;}
   return applyMovieMentorCreatorStateTransition(body,{...deps,readAuthoritativeTurnSource:async()=>{const e=Error("No creator state");e.code="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND";throw e;}});
  },runTurn:forbidden("turn")
 });
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
 const base="http://127.0.0.1:"+server.address().port+"/api/movie-mentor";
 const post=(path,id,token="Bearer isolated-valid")=>fetch(base+path,{method:"POST",headers:{"content-type":"application/json",authorization:token},body:JSON.stringify({projectId:project(id),operationId:"operation-"+id,source:"creator-memory",expectedRevision:0,state:{memoryContext:{note:"isolated real transition "+id}}})});
 const seed=async id=>ownerships.insertOne({projectId:project(id),ownerPrincipalId:"owner",ownershipReference:"ownership-"+project(id),ownershipRevision:1,status:"active",creatorStateFenceEpoch:0,establishmentAuthorityId:"establishment-"+id});
 const counts=async id=>({states:await states.countDocuments({projectId:project(id)}),operations:await operations.countDocuments({projectId:project(id)}),owner:await ownerships.findOne({projectId:project(id)})});
 // Negative ingress: real HTTP route must not write to disposable Mongo.
 await seed("invalid");
 const invalid=await post("/state/sync","invalid","Bearer invalid");
 assert.notEqual(invalid.status,200);assert.equal((await counts("invalid")).states,0);assert.equal((await counts("invalid")).operations,0);
 console.log("GREEN REAL TRANSITION A: invalid credential denied, zero durable writes");
 // Revocation after initial HTTP admission but before the mutation authority's fresh proof.
 await seed("revoked-after-admission");
 const pending=post("/state/sync","revoked-after-admission");
 await gate.reached;credential.revoked=true;gate.release();
 const denied=await pending;assert.notEqual(denied.status,200,"Post-admission revocation must deny before atomic write");
 const after=await counts("revoked-after-admission");
 assert.equal(after.states,0);assert.equal(after.operations,0);assert.equal(after.owner.creatorStateFenceEpoch,0);
 console.log("GREEN REAL TRANSITION B: revoked after HTTP admission, before atomic acceptance, zero durable writes");
 credential.revoked=false;
 // Positive control: same HTTP route, real transaction, real Mongo state and operation.
 await seed("authorized");
 const accepted=await post("/state/sync","authorized");
 const response=await accepted.json();
 assert.equal(accepted.status,200,JSON.stringify(response));
 const durable=await counts("authorized");
 assert.equal(durable.states,1);assert.equal(durable.operations,1);assert.equal(durable.owner.creatorStateFenceEpoch,1);
 console.log("GREEN REAL TRANSITION C: authorized HTTP sync committed one state, operation and ownership fence");
 // Same-record physical read court: no recovery fixture is seeded.
 const saved=await states.findOne({projectId:project("authorized")});
 assert.equal(saved?.revision,1);
 assert.equal(saved?.creatorStateGeneration,1);
 assert.equal(saved?.memoryContext?.note,"isolated real transition authorized");
 const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
 const issuer="https://isolated-clerk.example",audience="movie-mentor-same-record",origin="http://127.0.0.1:7777";
 const authentication=createMovieMentorProductionAuthenticationComposition({env:{
  MOVIE_MENTOR_CLERK_JWT_KEY:publicKey.export({type:"spki",format:"pem"}),
  MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([origin]),
  MOVIE_MENTOR_CLERK_ISSUER:issuer,MOVIE_MENTOR_AUDIENCE:audience
 }});
 assert.equal(authentication.ready,true);
 const sign=(subject,key=privateKey)=>{
  const now=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT"})).toString("base64url");
  const payload=Buffer.from(JSON.stringify({iss:issuer,aud:audience,azp:origin,sub:subject,sid:"isolated-session",iat:now,nbf:now-1,exp:now+300})).toString("base64url");
  const input=header+"."+payload;const signer=createSign("RSA-SHA256");signer.update(input);signer.end();
  return input+"."+signer.sign(key).toString("base64url");
 };
 const recoveryApp=express();
 recoveryApp.use("/api/movie-mentor",createMovieMentorCreatorStateRecoveryExpressRouter({
  authentication,ownershipAuthority:createMovieMentorProjectOwnershipAuthority(),
  readCreatorState:readAuthoritativeTurnSource
 }));
 const recoveryServer=createServer(recoveryApp);
 recoveryServer.listen(0,"127.0.0.1");await once(recoveryServer,"listening");
 try{
  const url="http://127.0.0.1:"+recoveryServer.address().port+"/api/movie-mentor/state/recovery/"+project("authorized");
  const get=async token=>{const response=await fetch(url,{headers:{authorization:"Bearer "+token}});return {status:response.status,body:await response.json()};};
  const owner=await get(sign("owner"));
  assert.equal(owner.status,200,JSON.stringify(owner.body));
  assert.equal(owner.body.state.projectId,saved.projectId);
  assert.equal(owner.body.state.revision,saved.revision);
  assert.equal(owner.body.state.creatorStateGeneration,saved.creatorStateGeneration);
  assert.equal(owner.body.state.memoryContext.note,saved.memoryContext.note);
  assert.equal((await get(sign("intruder"))).status,403);
  const {privateKey:forged}=generateKeyPairSync("rsa",{modulusLength:2048});
  assert.equal((await get(sign("owner",forged))).status,401);
  assert.deepEqual(await states.findOne({projectId:saved.projectId}),saved,"Recovery must not mutate saved state");
  console.log("GREEN SAME_RECORD_HTTP_MONGO_RECOVERY: atomic HTTP write and signed owner recovery read the identical durable Mongo record; intruder and forged JWT denied");
 }finally{await new Promise((resolve,reject)=>recoveryServer.close(e=>e?reject(e):resolve()));}
 console.log("LIMITATION: write admission uses injected request authority; recovery uses synthetic isolated Clerk RS256 and a new HTTP server in the same Node process; full fresh-process browser journey uncertified.");
}finally{
 if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 await mongoose.disconnect();
}
