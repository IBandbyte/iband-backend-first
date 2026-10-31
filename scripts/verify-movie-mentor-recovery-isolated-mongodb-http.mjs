import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createMovieMentorTurnRouter } from "../movieMentorTurn.js";

// Disposable MongoDB only. Never supply an external URI or production credentials.
if(process.env.MONGO_URI||process.env.MONGODB_URI) throw Error("Isolated Mongo court refuses preconfigured MongoDB credentials");
const mongod=await MongoMemoryServer.create();
process.env.MONGO_URI=mongod.getUri();
const projectId="isolated-film-recovery";
const state={projectId,creatorSessionId:"session-before-restart",revision:4,
  revisionAuthorityReference:"rev-4",creatorStateGeneration:4,
  creatorStateFingerprint:"fingerprint-4",creatorAuthorityReference:"creator-4",
  snapshotReference:"snapshot-4",creatorConfirmedContext:[{kind:"title",value:"Survives a New Session"}],
  projectJourney:{phase:"completed",scene:"ending"},memoryContext:{story:"Durable Film"},
  responseBlueprint:{next:"preview"},communicationPlan:{voice:"director"},
  capturedAt:new Date()};
let server;
try {
  await mongoose.connect(process.env.MONGO_URI);
  const collection=mongoose.connection.db.collection("movie_mentor_creator_state");
  await collection.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
  await collection.insertOne({...state,internalSecret:"never-expose"});
  await mongoose.disconnect(); // Close writer session; HTTP recovery must reconnect and read physical data.
  const requestAuthority={async authorize({request,projectId:pid}){
    const token=request.headers.authorization?.replace(/^Bearer /,"");
    if(!token)throw Object.assign(new Error("Credential required"),{code:"MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED"});
    if(token!=="owner"||pid!==projectId)throw Object.assign(new Error("Not owner"),{code:"MOVIE_MENTOR_CREATOR_PROJECT_NOT_AUTHORIZED"});
    return{authorized:true,projectId:pid,principalId:"owner",ownershipRef:"ownership-proof"};
  }};
  const settlement={reconcile(){},releaseUnclaimed(){},releaseUnbound(){}};
  const app=express();app.use(express.json());
  app.use("/api/movie-mentor",createMovieMentorTurnRouter({
    requestAuthority,inferenceSpendAuthority:{reserveTurn(){}},
    inferenceExecutionAuthority:{},inferenceSettlementAuthority:settlement
  }));
  server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/movie-mentor/state/recovery/`;
  const call=async(pid,token)=>{const res=await fetch(base+encodeURIComponent(pid),{headers:token?{authorization:`Bearer ${token}`}:{}});return{status:res.status,body:await res.json()};};
  assert.equal((await call(projectId)).status,401);
  assert.equal((await call(projectId,"stranger")).status,403);
  assert.equal((await call("other-film","owner")).status,403);
  const recovered=await call(projectId,"owner");
  assert.equal(recovered.status,200,JSON.stringify(recovered.body));
  assert.equal(recovered.body.state.revision,4);
  assert.deepEqual(recovered.body.state.projectJourney,state.projectJourney);
  assert.deepEqual(recovered.body.state.creatorConfirmedContext,state.creatorConfirmedContext);
  assert.equal(recovered.body.state.internalSecret,undefined);
  assert.equal(recovered.body.state.creatorSessionId,undefined);
  console.log("GREEN: isolated physical MongoDB saved state survived writer disconnect and authorized HTTP recovery.");
}finally{
  if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await mongoose.disconnect();
  await mongod.stop();
  delete process.env.MONGO_URI;
}
