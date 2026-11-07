import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionInferenceSpendComposition,isMovieMentorProductionInferenceSpendOwnerProof} from "../ai/MovieMentorProductionInferenceSpendComposition.js";
import {MOVIE_MENTOR_INFERENCE_SPEND_DOMAIN as DOMAIN,MOVIE_MENTOR_INFERENCE_SPEND_SCHEMA as SCHEMA,MOVIE_MENTOR_INFERENCE_ENTITLEMENT_COLLECTION as ENTITLEMENTS,MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_COLLECTION as RESERVATIONS} from "../ai/MovieMentorInferenceSpendMongoStore.js";

// Physical positive first financial boundary. This is NOT execution, settlement, or replay certification.
const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri),"Disposable localhost Mongo required");
process.env.MONGO_URI=uri;
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try {
 const db=mongoose.connection.db;
 await db.collection(ENTITLEMENTS).createIndex({principalId:1},{unique:true});
 await db.collection(RESERVATIONS).createIndex({reservationId:1},{unique:true});
 const principalId="isolated-positive-spend-"+Date.now(),projectId="isolated-positive-project";
 await db.collection(ENTITLEMENTS).insertOne({domain:DOMAIN,schema:SCHEMA,principalId,status:"active",remainingUnits:2,reservedUnits:0,consumedUnits:0,entitlementRevision:1});
 const composition=createMovieMentorProductionInferenceSpendComposition();
 assert.equal(composition.ready,true,composition.reason);
 assert.equal(isMovieMentorProductionInferenceSpendOwnerProof(composition,composition.getStatus()),true);
 const authority=composition.authority;
 const serverAuthority={authenticated:true,projectAuthorized:true,principalId,projectId};
 const reservation=await authority.reserveTurn({serverAuthority,projectId});
 assert.equal(reservation.authorized,true);
 assert.equal(reservation.status,"reserved");
 const row=await db.collection(RESERVATIONS).findOne({reservationId:reservation.reservationId});
 assert.ok(row,"physical reservation must exist");
 assert.equal(row.principalId,principalId);
 assert.equal(row.projectId,projectId);
 assert.equal(row.status,"reserved");
 const entitlement=await db.collection(ENTITLEMENTS).findOne({principalId});
 assert.equal(entitlement.remainingUnits,1);
 assert.equal(entitlement.reservedUnits,1);
 assert.equal(entitlement.consumedUnits,0);
 assert.equal(await db.collection(RESERVATIONS).countDocuments({principalId}),1);
 console.log("GREEN PHYSICAL POSITIVE SPEND: owner-proven production composition reserved one unit and durably minted one reservation in disposable Mongo");
 console.log("LIMITATION: reservation only; no durable execution, provider dispatch, canonical result, settlement, or replay proven.");
} finally {await mongoose.disconnect();}
