import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorProductionInferenceSpendComposition } from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import { createMovieMentorInferenceSettlementMongoStore } from "../ai/MovieMentorInferenceSettlementMongoStore.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI||"";
assert.match(uri,/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//);
assert.match(uri,/replicaSet=/);
process.env.MONGO_URI=uri;
const suffix=`settlement-denial-${process.pid}-${Date.now()}`;
const principalId=`${suffix}-owner`,projectId=`${suffix}-project`;
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 const entitlements=db.collection("movie_mentor_inference_entitlement");
 await entitlements.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,status:"active",remainingUnits:1,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 const spend=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(spend.ready,true);
 const reservation=await spend.authority.reserveTurn({serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},projectId,units:1});
 assert.equal(reservation.authorized,true);
 const settlement=createMovieMentorInferenceSettlementMongoStore();
 const reservationCollection=db.collection("movie_mentor_inference_spend_reservation");
 const beforeEntitlement=await entitlements.findOne({principalId});
 const beforeReservation=await reservationCollection.findOne({principalId});
 assert.equal(beforeEntitlement.remainingUnits,0);
 assert.equal(beforeEntitlement.reservedUnits,1);
 assert.equal(beforeEntitlement.consumedUnits,0);
 assert.equal(beforeReservation.status,"reserved");
 const missing=await settlement.settleCanonicalResult({executionId:`${suffix}-nonexistent-execution`});
 assert.equal(missing.authorized,false);
 assert.equal(missing.settled,false);
 assert.equal(missing.reason,"execution-not-found");
 assert.deepEqual(await entitlements.findOne({principalId}),beforeEntitlement);
 assert.deepEqual(await reservationCollection.findOne({principalId}),beforeReservation);
 console.log("GREEN production Mongo settlement rejects nonexistent execution without consuming reserved spend");
 console.log("LIMITATION: negative settlement gate only; real finalized execution/canonical result/settled replay remains uncertified.");
}finally{await mongoose.disconnect();}
