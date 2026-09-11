import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import {createMovieMentorProviderEffectMongoStore} from "../ai/MovieMentorProviderEffectMongoStore.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorProviderEffectMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");
assert.match(storeSource,/executionLedger\(\)\.updateOne\(/,"provider effect authority must cross execution durable barrier");
assert.match(storeSource,/storeModel\(\)\.create\(\[c\],\{session\}\)/,"UNKNOWN authority must reach irreversible provider-effect mint");
assert.match(storeSource,/providerEffectRealityRevision:1/,"provider effect evidence must serialize through execution reality revision");
assert.match(compositionSource,/createMovieMentorProviderEffectMongoStore\(\)/,"production inference composition must own the provider effect store");
assert.match(compositionSource,/beginProviderDispatch:providerBoundaryAuthority\.beginProviderDispatch/,"production dispatch must reach provider effect UNKNOWN authority");

function query(value=null){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
let effectWrites=0,executionTouches=0,transactions=0;
const fakeModel={
 collection:{async indexes(){return[{name:"providerCallId_1",key:{providerCallId:1},unique:true}];}},
 findOne(){return query(null);},
 find(){return query([]);},
 async create(records){effectWrites+=1;return Array.isArray(records)?records:[records];},
 findOneAndUpdate(){effectWrites+=1;return query(null);},
};
const executionCollection={async updateOne(){executionTouches+=1;return{matchedCount:1};}};
const session={async withTransaction(fn){transactions+=1;await fn();},async endSession(){}};
const requestedCollections=[];
const readPhysicalIndexes=async collectionName=>{
 requestedCollections.push(collectionName);
 if(collectionName==="movie_mentor_provider_effect_reality")return[{name:"providerCallId_1",key:{providerCallId:1},unique:true}];
 return[{name:"_id_",key:{_id:1},unique:true}];
};
const previous=mongoose.models.MovieMentorProviderEffectReality;
mongoose.models.MovieMentorProviderEffectReality=fakeModel;
try{
 const store=createMovieMentorProviderEffectMongoStore({connect:async()=>{},executionCollection,readPhysicalIndexes,startSession:async()=>session});
 await assert.rejects(
  ()=>store.beginUnknown({providerCallId:"provider-call-cross-ledger-physical",executionId:"execution-cross-ledger-physical",slotId:"semantic",task:"movie-mentor-semantic",dispatchUnknownAt:"2035-01-01T00:00:00.000Z",ownerId:"owner-cross-ledger-physical",leaseGeneration:3,leaseReference:"lease-cross-ledger-physical",fencingToken:"fence-cross-ledger-physical"}),
  error=>error?.code==="MOVIE_MENTOR_PROVIDER_EFFECT_CROSS_LEDGER_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "provider effect authority must fail closed when its execution mutation target lacks exact physical execution identity",
 );
}finally{
 if(previous)mongoose.models.MovieMentorProviderEffectReality=previous;else delete mongoose.models.MovieMentorProviderEffectReality;
}
assert.deepEqual(new Set(requestedCollections),new Set(["movie_mentor_provider_effect_reality","movie_mentor_inference_execution"]),"provider effect authority must inspect both its own identity and the execution identity it mutates");
assert.equal(transactions,0,"missing execution physical identity must fail before provider-effect transaction authority");
assert.equal(executionTouches,0,"missing execution physical identity must fail before execution reality mutation");
assert.equal(effectWrites,0,"missing execution physical identity must fail before UNKNOWN mint or evidence mutation");
console.log("GREEN: provider effect independently proves execution physical identity before cross-ledger transaction authority.");
console.log("LAW: PROVIDER-EFFECT SERIALIZATION MAY NOT BORROW EXECUTION PHYSICAL IDENTITY FROM THE EXECUTION AUTHORITY NEXT DOOR.");
