import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import {createMovieMentorInferenceSettlementPhysicalAuthority,MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//,"Disposable local Mongo URI required");
process.env.MONGO_URI=uri;
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000});
try {
 const db=mongoose.connection.db;
 const authority=createMovieMentorInferenceSettlementPhysicalAuthority({
  store:createMovieMentorInferenceSettlementMongoStore(),
  readIndexes:collection=>db.collection(collection).indexes()
 });
 const id="physical-settlement-denial-execution";
 const principalId="physical-settlement-denial-owner",projectId="physical-settlement-denial-project",reservationId="physical-settlement-denial-reservation";
 const executions=db.collection("movie_mentor_inference_execution");
 const reservations=db.collection("movie_mentor_inference_spend_reservation");
 const entitlements=db.collection("movie_mentor_inference_entitlement");
 await executions.insertOne({domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId:id,principalId,projectId,reservationId,phase:"active",providerCallsClaimed:0,providerCalls:[]});
 await reservations.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId,projectId,operation:"movie-mentor-turn",status:"reserved",units:2});
 await entitlements.insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,principalId,reservedUnits:2,consumedUnits:0,remainingUnits:3,entitlementRevision:1});
 const snapshot=async()=>({
  execution:await executions.findOne({executionId:id},{projection:{_id:0}}),
  reservation:await reservations.findOne({reservationId},{projection:{_id:0}}),
  entitlement:await entitlements.findOne({principalId},{projection:{_id:0}})
 });
 const initial=await snapshot();
 await assert.rejects(()=>authority.settleCanonicalResult({executionId:id}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_SETTLEMENT_PHYSICAL_AUTHORITY_UNAVAILABLE");
 assert.deepEqual(await snapshot(),initial,"Missing indexes must not mutate accounting or execution");
 for(const requirement of MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES)
  await db.collection(requirement.collection).createIndex(requirement.key,{unique:true});
 const denied=await authority.settleCanonicalResult({executionId:id});
 assert.equal(denied.settled,false);
 assert.equal(denied.authorized,false);
 assert.equal(denied.reason,"execution-not-finalized");
 assert.deepEqual(await snapshot(),initial,"Nonfinalized execution must not consume reservation or change balances");
 const replay=await authority.settleCanonicalResult({executionId:id});
 assert.equal(replay.reason,"execution-not-finalized");
 assert.deepEqual(await snapshot(),initial,"Repeated denial must not change durable state");
 console.log("GREEN: disposable real Mongo settlement denies missing-index delegation, denies nonfinalized execution after physical index readiness, and preserves execution, reservation and entitlement on repeated denial. Positive settlement, rollback after write, concurrent debit, legacy migration and HTTP remain uncertified.");
} finally {await mongoose.disconnect();}
