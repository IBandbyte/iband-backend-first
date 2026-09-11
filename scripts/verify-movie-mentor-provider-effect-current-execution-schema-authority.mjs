import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProviderEffectMongoStore} from "../ai/MovieMentorProviderEffectMongoStore.js";

const binding={providerCallId:"call-schema-boundary",executionId:"execution-schema-boundary",slotId:"semantic",task:"movie-mentor-semantic",ownerId:"owner-schema-boundary",leaseGeneration:4,leaseReference:"lease-schema-boundary",fencingToken:"fence-schema-boundary",dispatchUnknownAt:"2035-01-01T00:00:00.000Z"};

async function attempt(executionSchema){
  let effectRow=null,executionTouched=0;
  const query=()=>({session(){return this;},lean(){return this;},async exec(){return effectRow?structuredClone(effectRow):null;}});
  const fakeModel={collection:{async indexes(){return[{name:"_id_",key:{_id:1},unique:true},{name:"providerCallId_1",key:{providerCallId:1},unique:true}];}},findOne(){return query();},async create(rows){effectRow=structuredClone(rows[0]);return[structuredClone(effectRow)];}};
  const previous=mongoose.models.MovieMentorProviderEffectReality;mongoose.models.MovieMentorProviderEffectReality=fakeModel;
  const execution={domain:"iband.movie-mentor.inference-execution-store",schema:executionSchema,phase:"active",executionId:binding.executionId,ownerId:binding.ownerId,leaseGeneration:binding.leaseGeneration,leaseReference:binding.leaseReference,fencingToken:binding.fencingToken,leaseExpiresAt:new Date("2035-01-01T00:10:00.000Z"),providerCalls:[{providerCallId:binding.providerCallId,slotId:binding.slotId,task:binding.task,leaseGeneration:binding.leaseGeneration,leaseReference:binding.leaseReference,fencingToken:binding.fencingToken}]};
  const executionCollection={async indexes(){return[{name:"executionId_1",key:{executionId:1},unique:true}];},async updateOne(filter){const call=filter.providerCalls?.$elemMatch;const matches=execution.executionId===filter.executionId&&execution.phase===filter.phase&&execution.ownerId===filter.ownerId&&execution.leaseGeneration===filter.leaseGeneration&&execution.leaseReference===filter.leaseReference&&execution.fencingToken===filter.fencingToken&&execution.leaseExpiresAt>filter.leaseExpiresAt.$gt&&call?.providerCallId===binding.providerCallId&&call?.slotId===binding.slotId&&call?.task===binding.task&&call?.leaseGeneration===binding.leaseGeneration&&call?.leaseReference===binding.leaseReference&&call?.fencingToken===binding.fencingToken&&(!Object.hasOwn(filter,"schema")||execution.schema===filter.schema);if(matches)executionTouched+=1;return{matchedCount:matches?1:0};}};
  const session={async withTransaction(fn){return fn();},async endSession(){}};
  const store=createMovieMentorProviderEffectMongoStore({connect:async()=>{},executionCollection,startSession:async()=>session});
  try{return{ok:true,result:await store.beginUnknown(binding),executionTouched};}catch(error){return{ok:false,error,executionTouched};}finally{if(previous)mongoose.models.MovieMentorProviderEffectReality=previous;else delete mongoose.models.MovieMentorProviderEffectReality;}
}

const legacy=await attempt(5);assert.equal(legacy.ok,false,"legacy schema-5 execution history must fail closed before the irreversible provider-effect UNKNOWN boundary");assert.equal(legacy.error?.code,"MOVIE_MENTOR_PROVIDER_EFFECT_EXECUTION_FENCED");assert.equal(legacy.executionTouched,0,"legacy execution must not receive provider-effect reality revision authority");
const current=await attempt(6);assert.equal(current.ok,true,"current schema-6 execution must be able to durably establish UNKNOWN after exact admitted-call fencing");assert.equal(current.result.state,"unknown");assert.equal(current.executionTouched,1);
console.log("GREEN: provider-effect UNKNOWN independently requires the current durable execution schema at its own irreversible boundary.");
console.log("LAW: A CURRENT LEASE PROOF CANNOT LEND CURRENT-SCHEMA AUTHORITY TO A LEGACY EXECUTION AT A NEIGHBOURING DURABLE EFFECT BOUNDARY.");
