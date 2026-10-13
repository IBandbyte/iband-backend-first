import assert from "node:assert/strict";
import {createMovieMentorInferenceExecutionPhysicalAuthority} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const failures=[];
async function court(name,run){try{await run();console.log("GREEN:",name);}catch(error){failures.push(name);console.error("RED:",name,error.stack||error);}}
const indexes={
 movie_mentor_inference_execution:[
  {unique:true,key:{executionId:1}},
  {unique:true,key:{principalId:1,projectId:1,creatorTurnId:1}},
  {unique:true,key:{reservationId:1}}
 ],
 movie_mentor_inference_spend_reservation:[{unique:true,key:{reservationId:1}}]
};
const record={schema:6,phase:"active",executionId:"warp82-execution",ownerId:"worker",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseExpiresAt:"2032-01-01T00:01:00.000Z",providerCalls:[{providerCallId:"call-1",slotId:"semantic",leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1"}]};
const durable={
 async readExecution(){return record;},async readLiveExecution(){return record;},
 async readExecutionByCreatorTurn(){return record;},async createExecution(){return null;},
 async replaceExecution(){return null;},async claimProviderCall(){return null;},
 async beginClosing(){return null;},async recoverExpiredIntoClosing(){return null;},
 async completeClosing(){return null;},async quarantineExecution(){return null;}
};
await court("WARP82-A: production physical wrapper preserves durable live-dispatch proof",async()=>{
 const physical=createMovieMentorInferenceExecutionPhysicalAuthority({store:durable,readIndexes:async collection=>indexes[collection]});
 const lease=createMovieMentorInferenceExecutionLeaseAuthority({store:physical,now:()=>new Date("2032-01-01T00:00:00.000Z")});
 const result=await lease.assertProviderDispatch({providerCall:{authorized:true,executionId:record.executionId,providerCallId:"call-1",slotId:"semantic",leaseGeneration:1}});
 assert.equal(result.dispatchAuthorized,true,`a durably admitted live provider call must remain dispatchable through the production physical wrapper; received ${JSON.stringify(result)}`);
});
await court("WARP82-B: Mongo live-execution query binds server-time variable",async()=>{
 let captured=null;
 const mongoModel={findOne(filter){captured=filter;return{lean(){return this;},async exec(){return null;}};}};
 const store=createMovieMentorInferenceExecutionMongoStore({mongoModel});
 await store.readLiveExecution("warp82-execution");
 assert.deepEqual(captured?.$expr?.$gt,["$leaseExpiresAt","$$NOW"],"live lease must be compared with the MongoDB server-time system variable, not a document field");
});
await court("WARP82-C: dispatch fails closed when durable live proof is absent",async()=>{
 const noLive={...durable,async readLiveExecution(){return null;}};
 const physical=createMovieMentorInferenceExecutionPhysicalAuthority({store:noLive,readIndexes:async collection=>indexes[collection]});
 const lease=createMovieMentorInferenceExecutionLeaseAuthority({store:physical,now:()=>new Date("2032-01-01T00:00:00.000Z")});
 const result=await lease.assertProviderDispatch({providerCall:{authorized:true,executionId:record.executionId,providerCallId:"call-1",slotId:"semantic",leaseGeneration:1}});
 assert.equal(result.dispatchAuthorized,false,"dispatch without durable live execution must be denied");
});
await court("WARP82-D: live proof cannot bypass missing physical unique indexes",async()=>{
 const physical=createMovieMentorInferenceExecutionPhysicalAuthority({store:durable,readIndexes:async()=>[]});
 await assert.rejects(()=>physical.readLiveExecution(record.executionId),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_UNAVAILABLE");
});
if(failures.length){console.error("WARP82 verifier verdict: "+failures.length+" independent RED(s): "+failures.join(", "));process.exitCode=1;}
else console.log("WARP82 verifier verdict: ALL FOUR GREEN");
