import assert from "node:assert/strict";
import mongoose from "mongoose";
import { spawnSync } from "node:child_process";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";
import { recoverPreviouslyAdmittedProviderResult } from "../ai/MovieMentorRecoveredProviderResultAuthority.js";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";
import { describeCurrentMovieMentorProviderTarget } from "../ai/MovieMentorProviderTargetAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.ok(uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(uri),"isolated loopback Mongo URI required");
process.env.MONGO_URI=uri;
const id="restart-unknown-"+process.pid+"-"+Date.now();
const collectionNames={execution:"movie_mentor_inference_execution",operation:"movie_mentor_provider_operation_reality",effect:"movie_mentor_provider_effect_reality",reservation:"movie_mentor_inference_spend_reservation",entitlement:"movie_mentor_inference_entitlement"};
const target=describeCurrentMovieMentorProviderTarget();
async function connect(){await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});return mongoose.connection.db;}
async function main(){
 const db=await connect();
 try {
  for(const name of [collectionNames.execution,collectionNames.operation,collectionNames.effect])await db.collection(name).createIndex({providerCallId:1},{unique:true,sparse:true});
  const identity={providerCallId:id,executionId:id+"-execution",slotId:"semantic",task:"movie-mentor-semantic"};
  // Fixture records represent the post-admission UNKNOWN state. This court does not
  // claim to certify the upstream production admission transaction.
  await db.collection(collectionNames.execution).insertOne({executionId:identity.executionId,providerCalls:[{...identity,state:"admitted"}],ownerId:"worker-A",leaseGeneration:1,phase:"active"});
  const store=createMovieMentorProviderOperationMongoStore();
  await store.bindOperation({...identity,providerTarget:target,providerModel:"gpt-test",boundAt:new Date().toISOString()});
  await db.collection(collectionNames.effect).insertOne({...identity,state:"unknown",evidence:[],dispatchUnknownAt:new Date(),revision:1});
  const before=await Promise.all(Object.values(collectionNames).map(async name=>[name,await db.collection(name).countDocuments({})]));
  const durableBefore=await Promise.all([collectionNames.execution,collectionNames.operation,collectionNames.effect].map(async name=>[name,await db.collection(name).findOne(name===collectionNames.execution?{executionId:identity.executionId}:{providerCallId:id},{projection:{_id:0}})]));
  await mongoose.disconnect();
  const child=spawnSync(process.execPath,[new URL(import.meta.url).pathname,"--recovered-worker",id],{env:{...process.env,MOVIE_MENTOR_ISOLATED_MONGO_URI:uri},encoding:"utf8",timeout:30000});
  assert.equal(child.status,0,`fresh worker failed: ${child.stderr} ${child.stdout}`);
  await connect();
  const after=await Promise.all(Object.values(collectionNames).map(async name=>[name,await mongoose.connection.db.collection(name).countDocuments({})]));
  assert.deepEqual(after,before,"restart must not create any additional provider, spend, or settlement records");
  const durableAfter=await Promise.all([collectionNames.execution,collectionNames.operation,collectionNames.effect].map(async name=>[name,await mongoose.connection.db.collection(name).findOne(name===collectionNames.execution?{executionId:identity.executionId}:{providerCallId:id},{projection:{_id:0}})]));
  assert.deepEqual(durableAfter,durableBefore,"restart recovery must not silently mutate admitted execution, operation, or effect documents");
  const persisted=await mongoose.connection.db.collection(collectionNames.effect).findOne({providerCallId:id});
  assert.equal(persisted.state,"unknown");assert.deepEqual(persisted.evidence,[]);
  console.log(child.stdout.trim());
  console.log("GREEN isolated Mongo process-restart UNKNOWN recovery: fresh process reopens durable operation/effect/execution; no redispatch, recovery, refund or ledger mutation");
  console.log("LIMITATION: admission and UNKNOWN fixture seeding are not a production transaction; no physical provider socket is exercised in this court.");
 }finally{await mongoose.disconnect();}
}
if(process.argv[2]==="--recovered-worker"){assert.ok(process.argv[3]);const original=process.argv[3];if(!/^restart-unknown-[0-9]+-[0-9]+$/.test(original))throw Error("invalid isolated identity"); // child identity is independently passed
 await (async()=>{const db=await connect();const operation=await db.collection(collectionNames.operation).findOne({providerCallId:original});assert.ok(operation);await mongoose.disconnect();})();
 // Bind the parent's exact identity before invoking the recovery examination.
 // The worker receives only an operation ID, not in-memory records.
 await recoveredWorkerWithId(original);
}else await main();
async function recoveredWorkerWithId(callId){
 const db=await connect();
 try{
  const execution=await db.collection(collectionNames.execution).findOne({executionId:callId+"-execution"});
  assert.ok(execution?.providerCalls?.some(c=>c.providerCallId===callId));
  const store=createMovieMentorProviderOperationMongoStore();
  assert.equal((await store.readOperation(callId))?.providerCallId,callId);
  const recovery=createMovieMentorProviderOutcomeRecoveryAuthority({
   readProviderOperation:async key=>store.readOperation(key),
   readProviderEffectReality:async key=>db.collection(collectionNames.effect).findOne({providerCallId:key}),
   recoverProviderResponse:async()=>{throw Error("UNKNOWN must not call provider");},
   resolveCurrentTarget:()=>target
  });
  const outcome=await recovery.reconcile({providerCallId:callId});
  assert.equal(outcome.outcome,"STILL_UNKNOWN");
  assert.equal(outcome.redispatchAuthorized,false);assert.equal(outcome.refundAuthorized,false);assert.equal(outcome.recoveryAuthorized,false);
  await assert.rejects(()=>recoverPreviouslyAdmittedProviderResult({
   decision:{dispatchAuthorized:false,reason:"provider-call-slot-already-admitted",existingProviderCall:{providerCallId:callId,executionId:callId+"-execution",slotId:"semantic",task:"movie-mentor-semantic"}},
   execution:{executionId:callId+"-execution",ownerId:"worker-B",leaseGeneration:2},slotId:"semantic",task:"movie-mentor-semantic",input:{proof:true},
   recoverProviderOutcome:async()=>recovery.reconcile({providerCallId:callId}),
   readProviderOperation:async()=>{throw Error("UNKNOWN cannot reconstruct");},
   reconstructRecoveredResult:async()=>{throw Error("UNKNOWN cannot reconstruct");}
  }),e=>e?.code==="MOVIE_MENTOR_PROVIDER_RECOVERY_STILL_UNKNOWN");
  console.log("fresh-worker durable UNKNOWN denial GREEN");
 }finally{await mongoose.disconnect();}
}
