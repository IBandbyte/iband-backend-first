import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_barrier_mongoose_cast_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const store=createMovieMentorInferenceExecutionMongoStore();
let seq=0;
const authority=createMovieMentorInferenceExecutionLeaseAuthority({store,now:()=>new Date(),leaseMs:30000,maxProviderCalls:5,randomId:()=>`cast-${++seq}`});
try{
 await mongoose.connection.collection("movie_mentor_inference_spend_reservation").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"cast-reservation",principalId:"cast-creator",projectId:"cast-project",operation:"movie-mentor-turn",status:"reserved",executionBindingBarrierRevision:0});
 const opened=await authority.openExecution({creatorTurnId:"cast-turn",principalId:"cast-creator",projectId:"cast-project",reservationId:"cast-reservation",requestDigest:"sha256:cast",ownerId:"worker-A"});
 assert.equal(opened.authorized,true);
 const model=mongoose.models.MovieMentorInferenceExecution;
 assert.ok(model);
 assert.equal(model.schema.options.strict,true);
 assert.equal(model.schema.path("creatorDecisionBarrierRevision"),undefined);
 const raw=mongoose.connection.collection("movie_mentor_inference_execution");
 const result=await model.updateOne({executionId:opened.executionId},{$set:{creatorDecisionBarrierRevision:1}});
 const after=await raw.findOne({executionId:opened.executionId});
 const outcomes={modelStrict:true,barrierDeclared:false,matchedCount:result.matchedCount,modifiedCount:result.modifiedCount,barrierAfterMongooseUpdate:after.creatorDecisionBarrierRevision??null};
 assert.equal(outcomes.barrierAfterMongooseUpdate,null,"Current production strict Mongoose model must not be credited with persisting an undeclared barrier");
 const rawResult=await raw.updateOne({executionId:opened.executionId},{$set:{creatorDecisionBarrierRevision:1}});
 assert.equal(rawResult.modifiedCount,1);
 assert.equal((await raw.findOne({executionId:opened.executionId})).creatorDecisionBarrierRevision,1);
 console.log(JSON.stringify({court:"real-store-mongoose-barrier-write-contract",classification:"audit-only current production model strict-casting observation; raw collection write is a test fixture, not a production API",outcomes,rawMongoCanWrite:true}));
 console.log("PASS: current strict Mongoose update cannot persist undeclared barrier; raw Mongo can");
}finally{await mongoose.disconnect();}
