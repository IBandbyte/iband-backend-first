import assert from "node:assert/strict";
import mongoose from "mongoose";
import {MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES as executionIndexes} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";
import {MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES as settlementIndexes} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//,"Only disposable localhost Mongo allowed");
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try{
 const requirements=[...executionIndexes,...settlementIndexes];
 const unique=new Map(requirements.map(r=>[r.collection+":"+JSON.stringify(r.key),r]));
 assert.ok(unique.size>=7,"Must inspect multiple distinct real physical index requirements");
 const existing=await mongoose.connection.db.listCollections().toArray();
 const names=new Set(existing.map(c=>c.name));
 let missing=0;
 for(const requirement of unique.values()){
  const indexes=names.has(requirement.collection)?await mongoose.connection.db.collection(requirement.collection).indexes():[];
  const found=indexes.some(i=>i.unique===true&&JSON.stringify(i.key)===JSON.stringify(requirement.key));
  if(!found)missing++;
  console.log((found?"PRESENT":"MISSING")+" "+requirement.collection+" "+JSON.stringify(requirement.key));
 }
 assert.equal(missing,unique.size,"Fresh disposable database must have none of the required physical indexes");
 console.log("GREEN NEGATIVE CONTROL: inspected actual disposable Mongo collection/index metadata; all required execution and settlement unique indexes absent. Factory READY flags alone do not certify physical readiness.");
}finally{await mongoose.disconnect();}
