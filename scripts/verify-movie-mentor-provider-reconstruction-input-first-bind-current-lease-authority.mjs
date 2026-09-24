import assert from "node:assert/strict";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";

console.log("Movie Mentor provider reconstruction-input first-bind current lease authority court");

const clone = value => value == null ? value : structuredClone(value);
const historical = Object.freeze({
  providerCallId: "provider-call-input-generation-one",
  executionId: "execution-input-lease",
  slotId: "semantic",
  task: "movie-mentor-semantic",
  ownerId: "worker-generation-one",
  leaseGeneration: 1,
  leaseReference: "lease-generation-one",
  fencingToken: "fence-generation-one",
});
let row = {
  domain: "iband.movie-mentor.provider-operation-reality", schema: 1,
  providerCallId: historical.providerCallId, executionId: historical.executionId,
  slotId: historical.slotId, task: historical.task,
  providerTarget: { provider:"openai", adapter:"openai-responses", routeFingerprint:"a".repeat(64), recoveryMode:"known-response-id-retrieval" },
  providerModel: "gpt-test", boundAt: new Date("2036-01-01T00:00:00.000Z"),
  reconstructionInputDigest: null, reconstructionInput: null, reconstructionInputBoundAt: null,
};
const execution = {
  executionId: historical.executionId, schema: 6, phase: "active",
  ownerId: "worker-generation-two", leaseGeneration: 2,
  leaseReference: "lease-generation-two", fencingToken: "fence-generation-two",
  leaseExpiresAt: new Date("2036-01-01T00:10:00.000Z"),
  providerCalls: [{ providerCallId:historical.providerCallId, slotId:historical.slotId, task:historical.task,
    leaseGeneration:1, leaseReference:"lease-generation-one", fencingToken:"fence-generation-one" }],
};
const query=value=>({lean(){return this;},async exec(){return clone(value);}});
let operationMutations=0, executionTouches=0;
const mongoModel={
  collection:{async indexes(){return[{name:"providerCallId_1",key:{providerCallId:1},unique:true}];}},
  findOne(filter){return query(filter.providerCallId===row.providerCallId?row:null);},
  updateOne(filter,update){return{async exec(){operationMutations+=1;const ok=filter.providerCallId===row.providerCallId&&filter.executionId===row.executionId&&filter.slotId===row.slotId&&filter.task===row.task&&(row.reconstructionInputDigest==null);if(ok){row={...row,...clone(update.$set)};return{matchedCount:1,modifiedCount:1};}return{matchedCount:0,modifiedCount:0};}};},
};
const executionCollection={
  async updateOne(filter){executionTouches+=1;const call=filter.providerCalls?.$elemMatch||{};const current=filter.executionId===execution.executionId&&filter.schema===6&&filter.phase==="active"&&filter.ownerId===execution.ownerId&&filter.leaseGeneration===execution.leaseGeneration&&filter.leaseReference===execution.leaseReference&&filter.fencingToken===execution.fencingToken&&call.providerCallId===historical.providerCallId&&call.leaseGeneration===execution.leaseGeneration&&call.leaseReference===execution.leaseReference&&call.fencingToken===execution.fencingToken;return{matchedCount:current?1:0,modifiedCount:current?1:0};}
};
const store=createMovieMentorProviderOperationMongoStore({mongoModel,executionCollection});
await assert.rejects(
  ()=>store.bindReconstructionInput({...historical,reconstructionInputDigest:"digest-stale",reconstructionInput:{universe:"stale-generation-one"},boundAt:"2036-01-01T00:01:00.000Z"}),
  error=>error?.code==="MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_EXECUTION_FENCED",
  "first reconstruction-input bind must fail once the operation's admitting lease generation has been superseded",
);
assert.equal(row.reconstructionInputDigest,null,"stale generation must not win immutable historical-input authority");
assert.equal(operationMutations,0,"stale generation must be fenced before operation input mutation");
assert.equal(executionTouches,1,"court must exercise the current execution fence");
console.log("GREEN: superseded generation cannot win first durable reconstruction-input binding.");
console.log("LAW: AN UNBOUND HISTORICAL PROVIDER OPERATION MAY ACQUIRE ITS IMMUTABLE RECONSTRUCTION INPUT ONLY WHILE THE EXACT ADMITTING LEASE/FENCE REMAINS CURRENT.");
