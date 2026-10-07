import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorInferenceExecutionMongoStore} from "../ai/MovieMentorInferenceExecutionMongoStore.js";

const uri=process.env.MONGO_URI;
assert.ok(uri,"MONGO_URI required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});

const collectionName="movie_mentor_inference_execution";
const collection=mongoose.connection.collection(collectionName);
await collection.deleteMany({});

const now=new Date("2036-01-01T00:00:00.000Z");
const initial={
  domain:"iband.movie-mentor.inference-execution-store",
  schema:6,
  executionId:"execution-lease-reality-race",
  creatorTurnId:"turn-lease-reality-race",
  principalId:"creator-lease-reality-race",
  projectId:"project-lease-reality-race",
  reservationId:"reservation-lease-reality-race",
  requestDigest:"digest-lease-reality-race",
  phase:"active",
  ownerId:"owner-lease-reality-race",
  leaseGeneration:1,
  leaseReference:"lease-lease-reality-race",
  fencingToken:"fence-lease-reality-race",
  leaseAcquiredAt:new Date("2035-12-31T23:59:00.000Z"),
  leaseExpiresAt:new Date("2036-01-01T00:01:00.000Z"),
  maxProviderCalls:5,
  providerCallsClaimed:0,
  providerCalls:[],
  abandonedPredispatchProviderCalls:[],
  providerEffectRealityRevision:7,
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
  createdAt:now,
  updatedAt:now,
};
await collection.insertOne(initial);

const schema=new mongoose.Schema({},{
  collection:collectionName,
  strict:false,
  minimize:false,
});
const model=mongoose.models.MovieMentorLeaseRealityRaceExecution
  || mongoose.model("MovieMentorLeaseRealityRaceExecution",schema);

const originalFindOneAndUpdate=model.findOneAndUpdate.bind(model);
let interleavingInjected=false;
model.findOneAndUpdate=function(filter,update,options){
  if(!interleavingInjected){
    interleavingInjected=true;
    const query=originalFindOneAndUpdate(filter,update,options);
    const originalExec=query.exec.bind(query);
    query.exec=async function(){
      const advanced=await collection.updateOne(
        {executionId:initial.executionId,providerEffectRealityRevision:7},
        {$inc:{providerEffectRealityRevision:1}},
      );
      assert.equal(advanced.matchedCount,1,"court must physically advance provider-effect reality from N to N+1 before the stale lease replacement reaches Mongo");
      return originalExec();
    };
    return query;
  }
  return originalFindOneAndUpdate(filter,update,options);
};

const store=createMovieMentorInferenceExecutionMongoStore({mongoModel:model,reservationCollection:false});
const stale=await store.readExecution(initial.executionId);
assert.equal(stale.providerEffectRealityRevision,7);

const renewed={
  ...stale,
  leaseExpiresAt:"2036-01-01T00:02:00.000Z",
};

const outcome=await store.replaceExecution(renewed,{
  expectedPhase:"active",
  expectedLeaseGeneration:1,
  expectedLeaseReference:initial.leaseReference,
  expectedLeaseExpiresAt:"2036-01-01T00:01:00.000Z",
});

assert.equal(interleavingInjected,true,"court must inject the exact concurrent provider-reality advance");
const persisted=await collection.findOne({executionId:initial.executionId});
assert.equal(
  persisted.providerEffectRealityRevision,
  8,
  "lease replacement must not regress a concurrently advanced provider-effect reality revision",
);
assert.equal(
  outcome,
  null,
  "stale whole-record lease replacement must lose its CAS after provider-effect reality advances",
);

console.log("GREEN: lease replacement cannot overwrite a concurrent provider-effect reality revision advance.");
console.log("LAW: LEASE MAINTENANCE MAY EXTEND EXECUTION OWNERSHIP, BUT IT MAY NOT MOVE PROVIDER REALITY BACKWARD.");

await mongoose.disconnect();
