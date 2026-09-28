import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProviderEffectMongoStore} from "../ai/MovieMentorProviderEffectMongoStore.js";
const uri=process.env.MONGO_URI||process.env.MONGODB_URI;assert.ok(uri);await mongoose.connect(uri);
const db=mongoose.connection.db,effects=db.collection("movie_mentor_provider_effect_reality"),executions=db.collection("movie_mentor_inference_execution");await effects.deleteMany({});await executions.deleteMany({});
const serverNow=new Date((await db.command({hello:1})).localTime),laggingNow=new Date(serverNow.getTime()-120000),expiry=new Date(serverNow.getTime()-1000);
const call={providerCallId:"call-clock",executionId:"execution-clock",slotId:"semantic",task:"movie-mentor-semantic",ownerId:"worker-1",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",dispatchUnknownAt:laggingNow.toISOString()};
await executions.insertOne({domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:call.executionId,phase:"active",ownerId:call.ownerId,leaseGeneration:1,leaseReference:call.leaseReference,fencingToken:call.fencingToken,leaseExpiresAt:expiry,providerEffectRealityRevision:0,providerCalls:[{providerCallId:call.providerCallId,slotId:call.slotId,task:call.task,leaseGeneration:1,leaseReference:call.leaseReference,fencingToken:call.fencingToken}]});
const store=createMovieMentorProviderEffectMongoStore({connect:async()=>{},executionCollection:executions,startSession:()=>mongoose.startSession()});
let rejected=false;try{await store.beginUnknown(call);}catch(e){if(e?.code==="MOVIE_MENTOR_PROVIDER_EFFECT_EXECUTION_FENCED")rejected=true;else throw e;}
assert.equal(rejected,true,"Mongo-expired execution must not mint provider UNKNOWN/revision authority through lagging process time");
assert.equal(await effects.countDocuments({providerCallId:call.providerCallId}),0);
assert.equal((await executions.findOne({executionId:call.executionId})).providerEffectRealityRevision,0);
console.log("LAW: MONGO SERVER TIME OWNS UNKNOWN ADMISSION; PROCESS CLOCK SKEW MAY NOT MUTATE PROVIDER-EFFECT REALITY AFTER EXECUTION EXPIRY.");
await mongoose.disconnect();
