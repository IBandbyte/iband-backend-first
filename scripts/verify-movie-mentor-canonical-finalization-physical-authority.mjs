import assert from "node:assert/strict";
import fs from "node:fs";
import {createMovieMentorCanonicalResultMongoStore,MOVIE_MENTOR_CANONICAL_RESULT_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorCanonicalResultMongoStore.js";

console.log("Canonical finalization physical authority court");
const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");
assert.match(compositionSource,/createMovieMentorCanonicalResultMongoStore\(\)/,"production composition must create the canonical Mongo store");
assert.match(compositionSource,/createMovieMentorCanonicalResultAuthority\(\{store:durableResultStore/,"production canonical authority must consume the durable canonical store");
assert.match(storeSource,/async function commit\(/,"canonical store must expose the irreversible commit boundary");
assert.match(storeSource,/session\.withTransaction\(/,"canonical finalization must cross a Mongo transaction boundary");
for(const identity of [/schema\.index\(\{resultReference:1\},\{unique:true\}\)/,/schema\.index\(\{candidateReference:1\},\{unique:true\}\)/,/schema\.index\(\{executionId:1\},\{unique:true\}\)/,/schema\.index\(\{principalId:1,projectId:1,creatorTurnId:1\},\{unique:true\}\)/,/schema\.index\(\{reservationId:1\},\{unique:true\}\)/])assert.match(storeSource,identity,"canonical identity must remain schema-declared unique");
assert.equal(MOVIE_MENTOR_CANONICAL_RESULT_REQUIRED_UNIQUE_INDEXES.length,5,"canonical physical authority must own all five unique identities");

const physicalIndexes=MOVIE_MENTOR_CANONICAL_RESULT_REQUIRED_UNIQUE_INDEXES.map((key,i)=>({name:`required_${i}`,key:{...key},unique:true}));
let indexReads=0;
const readyStore=createMovieMentorCanonicalResultMongoStore({mongoModel:{},connect:async()=>{},readIndexes:async collection=>{indexReads++;assert.equal(collection,"movie_mentor_canonical_result");return physicalIndexes;},executionCollection:{},candidateCollection:{},startSession:async()=>{throw new Error("not expected");}});
const status=readyStore.getStatus();
assert.equal(status.physicalUniqueIndexReadiness,true);
assert.equal(status.uniquenessReadinessRequired,true);
assert.equal(status.readinessBoundary,"before-canonical-read-or-finalization-transaction");
await readyStore.ensurePhysicalAuthority();
await readyStore.ensurePhysicalAuthority();
assert.equal(indexReads,1,"successful physical readiness must be cached for the store instance");

let transactionStarts=0;
const missingReservation=physicalIndexes.filter(index=>!(index.key.reservationId===1&&Object.keys(index.key).length===1));
const blockedStore=createMovieMentorCanonicalResultMongoStore({mongoModel:{},connect:async()=>{},readIndexes:async()=>missingReservation,executionCollection:{},candidateCollection:{},startSession:async()=>{transactionStarts++;return{withTransaction:async()=>{},endSession:async()=>{}};}});
await assert.rejects(()=>blockedStore.commit({executionId:"exec_1"},{expectedProviderEffectRealityRevision:0}),error=>error?.code==="MOVIE_MENTOR_CANONICAL_RESULT_PHYSICAL_AUTHORITY_UNAVAILABLE"&&error?.retryable===true);
assert.equal(transactionStarts,0,"missing physical uniqueness must fail closed before a Mongo session or finalization transaction begins");

let underlyingReads=0;
const blockedReadStore=createMovieMentorCanonicalResultMongoStore({mongoModel:{findOne(){underlyingReads++;throw new Error("underlying read must not run");}},connect:async()=>{},readIndexes:async()=>missingReservation,executionCollection:{},candidateCollection:{}});
await assert.rejects(()=>blockedReadStore.readByExecution("exec_1"),error=>error?.code==="MOVIE_MENTOR_CANONICAL_RESULT_PHYSICAL_AUTHORITY_UNAVAILABLE");
assert.equal(underlyingReads,0,"missing physical uniqueness must fail closed before canonical read delegation");

const readyMatch=storeSource.match(/async function readyForCommit\(\)\{([\s\S]*?)\}async function readByExecution/);
assert.ok(readyMatch&&/physicalUniqueIndexReadiness/.test(readyMatch[1]),"commit readiness must cross physical authority before delegation");
const transactionAt=storeSource.indexOf("session.withTransaction"),physicalAt=storeSource.indexOf("physicalUniqueIndexReadiness");
assert.ok(physicalAt>=0&&physicalAt<transactionAt,"physical authority must precede irreversible transaction source order");
console.log("PASS canonical finalization owns actual five-index physical uniqueness proof and fails closed before read/finalization delegation");
