import assert from "node:assert/strict";
import mongoose from "mongoose";

// Fail-closed registration of the missing positive HTTP-origin settlement court.
// This verifier must not borrow the seeded canonical-settlement or replay GREENs.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//,"positive HTTP court requires loopback Mongo");
assert.match(uri,/replicaSet=/,"positive HTTP court requires an isolated replica set");
process.env.MONGO_URI=uri;
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const hello=await mongoose.connection.db.admin().command({hello:1});
 assert.ok(hello.setName,"positive HTTP court must use a replica set");
 const prefix=`positive-http-${process.pid}-${Date.now()}`;
 const creatorTurnId=`${prefix}-turn`;
 for(const [collection,query] of [
  ["movie_mentor_inference_execution",{creatorTurnId}],
  ["movie_mentor_inference_spend_reservation",{creatorTurnId}],
  ["movie_mentor_canonical_result",{creatorTurnId}],
 ]){
  assert.equal(await mongoose.connection.db.collection(collection).countDocuments(query),0,
   `positive HTTP-origin turn must not have a preseeded ${collection} record`);
 }
 console.log("GREEN positive HTTP precondition: isolated replica set, fresh creatorTurnId, no preseeded execution/reservation/canonical result");
 console.error("RED POSITIVE_HTTP_SETTLEMENT_JOURNEY_NOT_IMPLEMENTED: signed-JWT initial HTTP creation, real orchestrator, candidate/closure/canonical settlement and fresh-process replay must run in this same court; existing seeded-settlement GREEN is not sufficient.");
 process.exitCode=1;
}finally{
 await mongoose.disconnect();
}
