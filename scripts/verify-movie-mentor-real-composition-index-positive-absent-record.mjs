import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionInferenceExecutionComposition} from "../ai/MovieMentorProductionInferenceExecutionComposition.js";
import {createMovieMentorProductionInferenceSettlementComposition} from "../ai/MovieMentorProductionInferenceSettlementComposition.js";
import {MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES as executionIndexes} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";
import {MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES as settlementIndexes} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//);
process.env.MONGO_URI=uri;
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try{
 const requirements=new Map([...executionIndexes,...settlementIndexes].map(r=>[r.collection+":"+JSON.stringify(r.key),r]));
 for(const r of requirements.values())await mongoose.connection.db.collection(r.collection).createIndex(r.key,{unique:true});
 for(const r of requirements.values()){
  const indexes=await mongoose.connection.db.collection(r.collection).indexes();
  assert.ok(indexes.some(i=>i.unique===true&&JSON.stringify(i.key)===JSON.stringify(r.key)));
 }
 const execution=createMovieMentorProductionInferenceExecutionComposition();
 const settlement=createMovieMentorProductionInferenceSettlementComposition();
 assert.equal(execution.ready,true);
 assert.equal(settlement.ready,true);
 const lookup=await execution.authority.findExecutionByCreatorTurn({creatorTurnId:"isolated-turn",principalId:"isolated-principal",projectId:"isolated-project",requestDigest:"isolated-digest"});
 assert.equal(lookup.found,false,"Actual Mongo execution lookup should safely return absent");
 const release=await settlement.authority.releaseUnclaimed({executionId:"isolated-missing-execution"});
 assert.equal(release.authorized,false,"Actual Mongo settlement must not release nonexistent execution");
 assert.equal(release.released,false);
 assert.equal(release.reason,"execution-not-found");
 for(const collection of ["movie_mentor_inference_execution","movie_mentor_inference_spend_reservation","movie_mentor_inference_entitlement"]){
  assert.equal(await mongoose.connection.db.collection(collection).countDocuments({}),0,"No economic or execution records created: "+collection);
 }
 console.log("GREEN: real production compositions with real physical unique indexes permit actual Mongo execution lookup and settlement reconciliation, safely return absent/denied for nonexistent durable records, and create no economic records. This is not successful execution, debit or HTTP certification.");
}finally{await mongoose.disconnect();}
