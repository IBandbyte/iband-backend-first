import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import {createServer} from "node:http";
import {once} from "node:events";
import {createMovieMentorTurnRouter} from "../movieMentorTurn.js";
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
   assert.equal(typeof deps.atomicAcceptCreatorStateOperation,"function");
   if(body.projectId===project("revoked-after-admission")){gate.enter();await gate.held;}
   const id=body.projectId.slice("http-mongo-".length);
   return deps.atomicAcceptCreatorStateOperation({envelope:envelope(id),proposedState:proposed(id),creatorStateMutationAuthority:deps.creatorStateMutationAuthority});
  },runTurn:forbidden("turn")
 });
 const app=express();app.use(express.json());app.use("/api/movie-mentor",router);
 server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
 const base="http://127.0.0.1:"+server.address().port+"/api/movie-mentor";
 const post=(path,id,token="Bearer isolated-valid")=>fetch(base+path,{method:"POST",headers:{"content-type":"application/json",authorization:token},body:JSON.stringify({projectId:project(id)})});
 const seed=async id=>ownerships.insertOne({projectId:project(id),ownerPrincipalId:"owner",ownershipReference:"ownership-"+project(id),ownershipRevision:1,status:"active",creatorStateFenceEpoch:0,establishmentAuthorityId:"establishment-"+id});
 const counts=async id=>({states:await states.countDocuments({projectId:project(id)}),operations:await operations.countDocuments({projectId:project(id)}),owner:await ownerships.findOne({projectId:project(id)})});
 // Negative ingress: real HTTP route must not write to disposable Mongo.
 await seed("invalid");
 const invalid=await post("/state/sync","invalid","Bearer invalid");
 assert.notEqual(invalid.status,200);assert.equal((await counts("invalid")).states,0);assert.equal((await counts("invalid")).operations,0);
 console.log("GREEN HTTP+MONGO A: invalid credential denied, zero durable writes");
 // Revocation after initial HTTP admission but before the mutation authority's fresh proof.
 await seed("revoked-after-admission");
 const pending=post("/state/sync","revoked-after-admission");
 await gate.reached;credential.revoked=true;gate.release();
 const denied=await pending;assert.notEqual(denied.status,200,"Post-admission revocation must deny before atomic write");
 const after=await counts("revoked-after-admission");
 assert.equal(after.states,0);assert.equal(after.operations,0);assert.equal(after.owner.creatorStateFenceEpoch,0);
 console.log("GREEN HTTP+MONGO B: revoked after HTTP admission, before atomic acceptance, zero durable writes");
 credential.revoked=false;
 // Positive control: same HTTP route, real transaction, real Mongo state and operation.
 await seed("authorized");
 const accepted=await post("/state/sync","authorized");
 const response=await accepted.json();
 assert.equal(accepted.status,200,JSON.stringify(response));
 const durable=await counts("authorized");
 assert.equal(durable.states,1);assert.equal(durable.operations,1);assert.equal(durable.owner.creatorStateFenceEpoch,1);
 console.log("GREEN HTTP+MONGO C: authorized HTTP sync committed one state, operation and ownership fence");
 console.log("LIMITATION: injected authority and transition seam, /state/sync only; live provider and complete /turn journey uncertified.");
}finally{
 if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 await mongoose.disconnect();
}
