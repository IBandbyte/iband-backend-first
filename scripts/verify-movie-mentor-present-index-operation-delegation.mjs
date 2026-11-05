import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionPhysicalAuthority,MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES as executionIndexes} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";
import {createMovieMentorInferenceSettlementPhysicalAuthority,MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES as settlementIndexes} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//);
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try{
 const requirements=new Map([...executionIndexes,...settlementIndexes].map(r=>[r.collection+":"+JSON.stringify(r.key),r]));
 for(const r of requirements.values())await mongoose.connection.db.collection(r.collection).createIndex(r.key,{unique:true});
 for(const r of requirements.values()){
  const indexes=await mongoose.connection.db.collection(r.collection).indexes();
  assert.ok(indexes.some(i=>i.unique===true&&JSON.stringify(i.key)===JSON.stringify(r.key)),"Required physical unique index missing: "+r.collection+" "+JSON.stringify(r.key));
 }
 let executionCalls=0,settlementCalls=0;
 const methods=["readExecution","readExecutionByCreatorTurn","createExecution","replaceExecution","claimProviderCall","beginClosing","recoverExpiredIntoClosing","completeClosing","quarantineExecution"];
 const executionStore=Object.fromEntries(methods.map(name=>[name,async()=>{executionCalls++;return {operation:name,source:"isolated-store"}}]));
 const settlementStore={settleCanonicalResult:async()=>{settlementCalls++;return {operation:"settle",source:"isolated-store"}},releaseUnclaimedReservation:async()=>{settlementCalls++;return {operation:"release",source:"isolated-store"}},releaseUnboundReservation:async()=>{settlementCalls++;return {operation:"release-unbound",source:"isolated-store"}}};
 const readIndexes=async name=>mongoose.connection.db.collection(name).indexes();
 const execution=createMovieMentorInferenceExecutionPhysicalAuthority({store:executionStore,readIndexes});
 const settlement=createMovieMentorInferenceSettlementPhysicalAuthority({store:settlementStore,readIndexes});
 assert.deepEqual(await execution.readExecution({executionId:"isolated"}),{operation:"readExecution",source:"isolated-store"});
 assert.deepEqual(await settlement.releaseUnclaimedReservation({reservationId:"isolated"}),{operation:"release",source:"isolated-store"});
 assert.equal(executionCalls,1);
 assert.equal(settlementCalls,1);
 console.log("GREEN POSITIVE CONTROL: real unique Mongo indexes verified and execution/settlement physical wrappers delegate to isolated stub stores; no inference debit, provider call or production write. Full creator HTTP journey remains unverified.");
}finally{await mongoose.disconnect();}
