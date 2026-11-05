import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionInferenceExecutionComposition} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import {createMovieMentorProductionInferenceSettlementComposition} from "../ai/MovieMentorProductionInferenceSettlementComposition.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//);
process.env.MONGO_URI=uri;
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try{
 const execution=createMovieMentorProductionInferenceExecutionComposition();
 const settlement=createMovieMentorProductionInferenceSettlementComposition();
 assert.equal(execution.ready,true,"Actual production execution composition must construct");
 assert.equal(settlement.ready,true,"Actual production settlement composition must construct");
 const before=await mongoose.connection.db.listCollections().toArray();
 assert.equal(before.length,0,"Fresh isolated database must have no collections or indexes");
 await assert.rejects(()=>execution.authority.findExecutionByCreatorTurn({creatorTurnId:"isolated-turn",principalId:"isolated-principal",projectId:"isolated-project",requestDigest:"isolated-digest"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_UNAVAILABLE");
 await assert.rejects(()=>settlement.authority.releaseUnclaimed({executionId:"isolated-execution"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_UNAVAILABLE");
 const after=await mongoose.connection.db.listCollections().toArray();
 assert.equal(after.length,0,"Denied real composition operations must not create collections or records");
 console.log("GREEN: actual production execution and settlement compositions constructed, but real operations fail closed on missing physical Mongo indexes without database mutation. Full HTTP creator journey remains unverified.");
}finally{await mongoose.disconnect();}
