import assert from "node:assert/strict";
import express from "express";
import mongoose from "mongoose";
import {createServer} from "node:http";
import {once} from "node:events";
import {createMovieMentorProductionAuthenticationComposition} from "../ai/MovieMentorProductionAuthenticationComposition.js";
import {createMovieMentorCreatorStateRecoveryExpressRouter} from "../ai/MovieMentorCreatorStateRecoveryExpressRouter.js";
import {createMovieMentorProjectOwnershipAuthority} from "../ai/MovieMentorProjectOwnershipRegistry.js";
import {readAuthoritativeTurnSource} from "../ai/MovieMentorCreatorStateStore.js";

// Independent Node process. The parent may only supply public verification material
// and signed test tokens; no injected creator state or read/ownership doubles.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri||""),"Disposable localhost Mongo required");
const expected=JSON.parse(process.env.MM_EXPECTED_STATE||"null");
assert.ok(expected?.projectId&&expected.revision===1&&expected.creatorStateGeneration===1);
const authentication=createMovieMentorProductionAuthenticationComposition({env:{
 MOVIE_MENTOR_CLERK_JWT_KEY:process.env.MM_PUBLIC_KEY,
 MOVIE_MENTOR_CLERK_AUTHORIZED_PARTIES_JSON:JSON.stringify([process.env.MM_ORIGIN]),
 MOVIE_MENTOR_CLERK_ISSUER:process.env.MM_ISSUER,
 MOVIE_MENTOR_AUDIENCE:process.env.MM_AUDIENCE
}});
assert.equal(authentication.ready,true);
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
let server;
try{
 const states=mongoose.connection.db.collection("movie_mentor_creator_state");
 const operations=mongoose.connection.db.collection("movie_mentor_creator_state_operations");
 const ownerships=mongoose.connection.db.collection("movie_mentor_project_ownership");
 const before=await states.findOne({projectId:expected.projectId});
 const operationBefore=await operations.findOne({projectId:expected.projectId});
 const ownershipBefore=await ownerships.findOne({projectId:expected.projectId});
 assert.ok(before&&operationBefore&&ownershipBefore,"Fresh process must reopen original Mongo write lineage");
 const app=express();
 app.use("/api/movie-mentor",createMovieMentorCreatorStateRecoveryExpressRouter({
  authentication,ownershipAuthority:createMovieMentorProjectOwnershipAuthority(),
  readCreatorState:readAuthoritativeTurnSource
 }));
 server=createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
 const url="http://127.0.0.1:"+server.address().port+"/api/movie-mentor/state/recovery/"+encodeURIComponent(expected.projectId);
 const get=async token=>{const r=await fetch(url,{headers:{authorization:"Bearer "+token},cache:"no-store"});return {status:r.status,body:await r.json()};};
 const owner=await get(process.env.MM_OWNER_TOKEN);
 assert.equal(owner.status,200,JSON.stringify(owner.body));
 assert.equal(owner.body.state.projectId,expected.projectId);
 assert.equal(owner.body.state.revision,expected.revision);
 assert.equal(owner.body.state.creatorStateGeneration,expected.creatorStateGeneration);
 assert.deepEqual(owner.body.state.memoryContext,expected.memoryContext);
 assert.equal((await get(process.env.MM_INTRUDER_TOKEN)).status,403);
 assert.equal((await get(process.env.MM_FORGED_TOKEN)).status,401);
 assert.deepEqual(await states.findOne({projectId:expected.projectId}),before);
 assert.deepEqual(await operations.findOne({projectId:expected.projectId}),operationBefore);
 assert.deepEqual(await ownerships.findOne({projectId:expected.projectId}),ownershipBefore);
 console.log("GREEN FRESH_PROCESS_SAME_RECORD_RECOVERY: independent Node process reopened original HTTP-committed Mongo state and operation; signed owner read matched exact revision and content; intruder/forgery denied; all durable records immutable");
}finally{
 if(server)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 await mongoose.disconnect();
}
