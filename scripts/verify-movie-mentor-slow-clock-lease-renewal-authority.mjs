import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

assert.ok(process.env.MONGO_URI,"MONGO_URI required for physical MongoDB court");
await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
try {
 const collection=mongoose.connection.db.collection("movie_mentor_inference_execution");
 await collection.deleteMany({});
 const slowClock=()=>new Date(Date.now()-90_000);
 let id=0;
 const authority=createMovieMentorInferenceExecutionLeaseAuthority({
  store:createMovieMentorInferenceExecutionMongoStore(),
  now:slowClock,leaseMs:60_000,maxProviderCalls:5,
  randomId:()=>`slow-clock-court-${++id}`,
 });
 const opened=await authority.openExecution({
  creatorTurnId:"turn-slow-clock-renewal",principalId:"principal-slow-clock",
  projectId:"project-slow-clock",reservationId:"reservation-slow-clock",
  requestDigest:"digest-slow-clock",ownerId:"owner-slow-clock",
 });
 assert.equal(opened.authorized,true,"court requires real authority-issued ownership proof");
 const executionId=opened.executionId;
 const before=await collection.findOne({executionId});
 assert.ok(before,"court must physically persist the execution");
 assert.equal(before.schema,6,"court requires current production schema");
 assert.equal(before.leaseGeneration,1,"court must begin with generation-one ownership");
 assert.ok(new Date(before.leaseExpiresAt).getTime()>slowClock().getTime(),
  "slow worker must consider its own lease live");
 const expired=await collection.countDocuments({
  executionId,$expr:{$lte:["$leaseExpiresAt","$$NOW"]},
 });
 assert.equal(expired,1,"MongoDB must already consider the lease expired before renewal");
 const renewed=await authority.renewExecution(opened);
 const after=await collection.findOne({executionId});
 assert.equal(renewed.authorized,false,
  "RED: slow-clock worker renewed an already MongoDB-expired lease and minted fresh ownership evidence");
 assert.equal(new Date(after.leaseExpiresAt).getTime(),new Date(before.leaseExpiresAt).getTime(),
  "RED: slow-clock renewal extended a lease already expired by MongoDB server time");
 assert.equal(after.leaseGeneration,1);
 console.log("GREEN: MongoDB-expired execution cannot be renewed by a slow-clock worker.");
 console.log("LAW: DURABLE MONGODB TIME, NOT PROCESS-LOCAL TIME, GOVERNS LEASE RENEWAL.");
} finally {
 await mongoose.disconnect();
}
