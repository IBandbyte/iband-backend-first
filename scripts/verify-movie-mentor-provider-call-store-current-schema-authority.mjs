import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
function q(value){return{lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function execution(schema){return{domain:"iband.movie-mentor.inference-execution-store",schema,executionId:`execution-schema-${schema}`,creatorTurnId:`turn-schema-${schema}`,principalId:"creator-schema-court",projectId:"project-schema-court",reservationId:`reservation-schema-${schema}`,requestDigest:`request-schema-${schema}`,phase:"active",ownerId:"owner-schema-court",leaseGeneration:4,leaseReference:"lease-schema-court",fencingToken:"fence-schema-court",leaseAcquiredAt:new Date("2035-01-01T00:00:00.000Z"),leaseExpiresAt:new Date("2035-01-01T00:10:00.000Z"),maxProviderCalls:2,providerCallsClaimed:0,providerCalls:[],providerEffectRealityRevision:0};}
const rows=new Map([[6,execution(6)],[5,execution(5)]]),filters=new Map();
const fake={findOne(filter){const row=[...rows.values()].find(v=>v.executionId===filter.executionId)||null;return q(row);},findOneAndUpdate(filter,update){const entry=[...rows.entries()].find(([,v])=>v.executionId===filter.executionId);if(!entry)return q(null);const [schema,row]=entry;filters.set(schema,structuredClone(filter));const schemaMatches=filter.schema===undefined||filter.schema===row.schema;const matches=schemaMatches&&filter.phase===row.phase&&filter.ownerId===row.ownerId&&filter.leaseGeneration===row.leaseGeneration&&filter.leaseReference===row.leaseReference&&filter.fencingToken===row.fencingToken;if(!matches)return q(null);const next={...row,...(update.$set||{}),providerCalls:[...row.providerCalls,...(update.$push?.providerCalls?[update.$push.providerCalls]:[])],providerCallsClaimed:row.providerCallsClaimed+(update.$inc?.providerCallsClaimed||0)};rows.set(schema,next);return q(next);}};
const previous=mongoose.models.MovieMentorInferenceExecution;mongoose.models.MovieMentorInferenceExecution=fake;
try{
  const store=createMovieMentorInferenceExecutionMongoStore({connect:async()=>{}});
  const claim=async schema=>{const row=rows.get(schema);return store.claimProviderCall({executionId:row.executionId,ownerId:row.ownerId,leaseGeneration:row.leaseGeneration,leaseReference:row.leaseReference,fencingToken:row.fencingToken,providerCallId:`call-schema-${schema}`,slotId:"semantic",task:"movie-mentor-semantic",admittedAt:new Date("2035-01-01T00:01:00.000Z")});};
  const current=await claim(6);assert.equal(current.claimed,true,"current schema 6 must admit provider call");
  const legacy=await claim(5);assert.equal(legacy.claimed,false,"legacy schema 5 must not acquire a new durable provider-call claim");
  assert.equal(filters.get(6)?.schema,6,"provider-call atomic filter must own current schema 6");assert.equal(filters.get(5)?.schema,6,"legacy row must not be silently upgraded while acquiring provider-call authority");
} finally {if(previous)mongoose.models.MovieMentorInferenceExecution=previous;else delete mongoose.models.MovieMentorInferenceExecution;}
console.log("GREEN: provider-call store atomically owns current execution schema at durable claim.");
console.log("LAW: THE STORE THAT MINTS A PROVIDER-CALL CLAIM MAY NOT BORROW CURRENT-SCHEMA AUTHORITY FROM ITS CALLER OR UPGRADE LEGACY HISTORY AS A SIDE EFFECT.");
