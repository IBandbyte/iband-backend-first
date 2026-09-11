import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");

assert.match(storeSource,/creatorStateLedger\(\)\.updateOne\(/,"candidate mint must cross creator-state durable barrier");
assert.match(storeSource,/executionLedger\(\)\.updateOne\(/,"candidate mint must cross execution durable barrier");
assert.match(storeSource,/storeModel\(\)\.create\(\[record\],\{session\}\)/,"candidate authority must reach irreversible durable mint");
assert.match(compositionSource,/return durableCandidateStore\.stageCandidate\(/,"production stageResultCandidate must reach candidate transaction");
assert.match(compositionSource,/database\.collection\(collectionName\)\.indexes\(\)/,"production owns a physical catalogue reader capable of proving every touched collection");

function query(value=null){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
let candidateWrites=0,creatorStateBarriers=0,executionBarriers=0,transactions=0;
const fakeCandidateModel={
  findOne(){return query(null);},
  async create(records){candidateWrites+=1;return Array.isArray(records)?records:[records];},
};
const session={async withTransaction(fn){transactions+=1;await fn();},async endSession(){}};
const requestedCollections=[];
const readIndexes=async collectionName=>{
  requestedCollections.push(collectionName);
  if(collectionName==="movie_mentor_result_candidate")return[
    {name:"executionId_1",key:{executionId:1},unique:true},
    {name:"candidateReference_1",key:{candidateReference:1},unique:true},
  ];
  return [{name:"_id_",key:{_id:1},unique:true}];
};
const creatorStateCollection={async updateOne(){creatorStateBarriers+=1;return{matchedCount:1};}};
const executionCollection={async updateOne(){executionBarriers+=1;return{matchedCount:1};}};
const execution={authorized:true,executionAuthorized:true,executionId:"execution-cross-ledger-physical",creatorTurnId:"turn-cross-ledger-physical",principalId:"creator-cross-ledger-physical",projectId:"project-cross-ledger-physical",reservationId:"reservation-cross-ledger-physical",requestDigest:"request-cross-ledger-physical",ownerId:"owner-cross-ledger-physical",leaseGeneration:3,leaseReference:"lease-cross-ledger-physical",fencingToken:"fence-cross-ledger-physical"};
const proof={domain:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,schema:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:execution.principalId,projectId:execution.projectId,ownershipRef:"ownership-cross-ledger-physical",ownershipRevision:2,stage:"result-candidate",revision:8,creatorStateGeneration:4,creatorStateFingerprint:"creator-state-cross-ledger-physical",executionId:execution.executionId,providerCallId:null};

const previous=mongoose.models.MovieMentorResultCandidate;
mongoose.models.MovieMentorResultCandidate=fakeCandidateModel;
try{
  const store=createMovieMentorResultCandidateMongoStore({connect:async()=>{},startSession:async()=>session,executionCollection,creatorStateCollection,readIndexes,now:()=>new Date("2035-01-01T00:00:00.000Z"),randomId:()=>"cross-ledger-physical"});
  await assert.rejects(
    ()=>store.stageCandidate({execution,resultPayload:{response:"candidate"},creatorStateConsumptionProof:proof}),
    error=>error?.code==="MOVIE_MENTOR_RESULT_CANDIDATE_CROSS_LEDGER_PHYSICAL_AUTHORITY_UNAVAILABLE",
    "candidate authority must fail closed when creator-state and execution target identities are not physically unique even if candidate indexes are healthy",
  );
}finally{
  if(previous)mongoose.models.MovieMentorResultCandidate=previous;else delete mongoose.models.MovieMentorResultCandidate;
}

assert.deepEqual(new Set(requestedCollections),new Set(["movie_mentor_result_candidate","movie_mentor_creator_state","movie_mentor_inference_execution"]),"candidate authority must independently inspect every collection whose singleton identity it mutates");
assert.equal(transactions,0,"missing cross-ledger physical identities must fail before transaction authority");
assert.equal(creatorStateBarriers,0,"missing creator-state physical identity must fail before creator-state mutation");
assert.equal(executionBarriers,0,"missing execution physical identity must fail before execution mutation");
assert.equal(candidateWrites,0,"missing cross-ledger physical identities must fail before candidate mint");
console.log("GREEN: result-candidate staging independently proves physical singleton identities for every cross-ledger mutation before transaction authority.");
console.log("LAW: A TRANSACTIONAL BARRIER MAY NOT BORROW ITS TARGET COLLECTION'S PHYSICAL IDENTITY PROOF FROM A NEIGHBOUR.");
