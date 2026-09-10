import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorInferenceExecutionPhysicalAuthority,MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorInferenceExecutionPhysicalAuthority.js";

let delegated=0;
const delegate={
  readExecution:async()=>null,
  readExecutionByCreatorTurn:async()=>null,
  createExecution:async()=>{delegated+=1;return{executionId:"execution-1"};},
  replaceExecution:async()=>null,
  claimProviderCall:async()=>({claimed:false}),
  beginClosing:async()=>null,
  recoverExpiredIntoClosing:async()=>null,
  completeClosing:async()=>null,
  quarantineExecution:async()=>null
};
const completeIndexes=new Map();
for(const requirement of MOVIE_MENTOR_INFERENCE_EXECUTION_REQUIRED_UNIQUE_INDEXES){const list=completeIndexes.get(requirement.collection)||[];list.push({key:{...requirement.key},unique:true});completeIndexes.set(requirement.collection,list);}
const reads=[];
const authority=createMovieMentorInferenceExecutionPhysicalAuthority({store:delegate,readIndexes:async collection=>{reads.push(collection);return completeIndexes.get(collection)||[];}});
const status=authority.getStatus();
assert.equal(status.uniquenessReadinessRequired,true);
assert.equal(status.physicalUniqueIndexReadiness,true);
assert.equal(status.readinessBoundary,"before-execution-read-or-mutation-delegation");
await authority.createExecution({executionId:"execution-1"});
assert.equal(delegated,1,"execution mutation may delegate only after physical readiness succeeds");
assert.equal(new Set(reads).size,2,"execution authority must inspect both execution and reservation physical index reality");
const readsAfterFirst=reads.length;
await authority.readExecution("execution-1");
assert.equal(reads.length,readsAfterFirst,"successful physical readiness may be cached for the composed production authority");

const brokenIndexes=new Map([...completeIndexes].map(([collection,indexes])=>[collection,indexes.map(index=>({...index,key:{...index.key}}))]));
brokenIndexes.set("movie_mentor_inference_execution",(brokenIndexes.get("movie_mentor_inference_execution")||[]).filter(index=>!(index.key?.reservationId===1&&Object.keys(index.key).length===1)));
let blockedDelegation=0;
const blockedStore={...delegate,createExecution:async()=>{blockedDelegation+=1;}};
const blocked=createMovieMentorInferenceExecutionPhysicalAuthority({store:blockedStore,readIndexes:async collection=>brokenIndexes.get(collection)||[]});
await assert.rejects(()=>blocked.createExecution({executionId:"execution-2"}),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_PHYSICAL_AUTHORITY_UNAVAILABLE"&&error?.retryable===true);
assert.equal(blockedDelegation,0,"missing execution identity index authority must fail closed before irreversible mutation");

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");
assert.match(storeSource,/schema\.index\(\{executionId:1\},\{unique:true\}\)/);
assert.match(storeSource,/schema\.index\(\{principalId:1,projectId:1,creatorTurnId:1\},\{unique:true\}\)/);
assert.match(storeSource,/schema\.index\(\{reservationId:1\},\{unique:true\}\)/);
assert.match(storeSource,/session\.withTransaction/);
assert.match(compositionSource,/createMovieMentorInferenceExecutionPhysicalAuthority\(\{store:durableStore,readIndexes:readPhysicalIndexes\}\)/,"production composition must own the physical execution gate");
assert.match(compositionSource,/database\.collection\(collectionName\)\.indexes\(\)/,"production proof must inspect actual Mongo index reality rather than schema declarations");
assert.match(compositionSource,/createMovieMentorInferenceExecutionLeaseAuthority\(\{store:physicalStore/,"live execution authority must consume the physically gated store");
assert.match(compositionSource,/createMovieMentorInferenceExecutionClosureAuthority\(\{store:physicalStore/,"closure authority must consume the same physically gated store");
assert.match(compositionSource,/physicalUniqueIndexReadiness:true/);

console.log("PASS inference execution index readiness — physical execution and reservation unique-index reality is proven before irreversible execution mutation.");
console.log("LAW: EXECUTION IDENTITY, CREATOR-TURN IDENTITY, AND RESERVATION BINDING ARE NOT AUTHORITATIVE UNTIL THEIR PHYSICAL UNIQUE INDEXES ARE READY.");
