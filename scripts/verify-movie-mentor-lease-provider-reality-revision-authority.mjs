import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import {createMovieMentorInferenceExecutionLeaseAuthority} from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const uri=process.env.MONGO_URI;
assert.ok(uri,"MONGO_URI required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
const db=mongoose.connection.db;
const executions=db.collection("movie_mentor_inference_execution");
await executions.deleteMany({});

const executionId="execution-lease-provider-reality-race";
const expiredAt=new Date(Date.now()-60_000);
const acquiredAt=new Date(expiredAt.getTime()-60_000);
await executions.insertOne({
 domain:"iband.movie-mentor.inference-execution-store",
 schema:6,
 executionId,
 creatorTurnId:"turn-lease-provider-reality-race",
 principalId:"creator-lease-provider-reality-race",
 projectId:"project-lease-provider-reality-race",
 reservationId:"reservation-lease-provider-reality-race",
 requestDigest:"request-lease-provider-reality-race",
 phase:"active",
 ownerId:"owner-generation-one",
 leaseGeneration:1,
 leaseReference:"lease-generation-one",
 fencingToken:"fence-generation-one",
 leaseAcquiredAt:acquiredAt,
 leaseExpiresAt:expiredAt,
 maxProviderCalls:5,
 providerCallsClaimed:0,
 providerCalls:[],
 abandonedPredispatchProviderCalls:[],
 providerEffectRealityRevision:0,
 settlementRealityBarrierRevision:0,
 resultFinalizationBarrierRevision:0,
 resultCandidateBarrierRevision:0,
 closureReference:"",
 frozenProviderCallCount:null,
 frozenProviderCallSetDigest:"",
 closingAt:null,
 closedFromExecutionGeneration:null,
 closurePolicyVersion:"",
 closureCertificateDigest:"",
 closedAt:null,
 finalizedResultReference:"",
 finalizedCandidateReference:"",
 finalizedResultDigest:"",
 resultFinalizedAt:null,
 settledResultReference:"",
 settledCandidateReference:"",
 settledResultDigest:"",
 settledAt:null,
 abortedAt:null,
 abortReason:"",
 compensatedAt:null,
 compensationReason:"",
 quarantinedAt:null,
 quarantineReason:"",
 quarantinedFromPhase:"",
});

const productionStore=createMovieMentorInferenceExecutionMongoStore();
let injectedRealityAdvance=false;
const racedStore=Object.freeze({
 readExecution:(...args)=>productionStore.readExecution(...args),
 readExecutionByCreatorTurn:(...args)=>productionStore.readExecutionByCreatorTurn(...args),
 createExecution:(...args)=>productionStore.createExecution(...args),
 claimProviderCall:(...args)=>productionStore.claimProviderCall(...args),
 async replaceExecution(record,expected){
  if(!injectedRealityAdvance){
   const advanced=await executions.updateOne(
    {executionId,providerEffectRealityRevision:0},
    {$inc:{providerEffectRealityRevision:1}},
   );
   assert.equal(advanced.matchedCount,1,"court must physically advance provider reality after lease snapshot and before lease replacement");
   injectedRealityAdvance=true;
  }
  return productionStore.replaceExecution(record,expected);
 },
});

const authority=createMovieMentorInferenceExecutionLeaseAuthority({
 store:racedStore,
 now:()=>new Date(),
 leaseMs:60_000,
 maxProviderCalls:5,
 randomId:(()=>{let n=0;return()=>`lease-reality-race-${++n}`;})(),
});

const acquired=await authority.acquireExecution({executionId,ownerId:"owner-generation-two"});
assert.equal(injectedRealityAdvance,true,"court must cross the physical provider-reality race");
assert.equal(acquired.authorized,true,"lease takeover should remain otherwise legitimate");

const durable=await executions.findOne({executionId});
assert.equal(
 durable.providerEffectRealityRevision,
 1,
 "RED: lease replacement rewrote a concurrently advanced providerEffectRealityRevision with its stale pre-race snapshot.",
);

console.log("GREEN: lease replacement preserves a concurrently advanced provider-effect reality revision.");
console.log("LAW: LEASE ACQUIRE/RENEW MAY CHANGE LEASE AUTHORITY; IT MAY NOT REWRITE PROVIDER REALITY FROM A STALE EXECUTION SNAPSHOT.");
await mongoose.disconnect();
