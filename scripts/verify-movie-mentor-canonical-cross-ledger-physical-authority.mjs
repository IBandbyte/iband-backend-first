import assert from "node:assert/strict";
import {createMovieMentorCanonicalResultMongoStore,MOVIE_MENTOR_CANONICAL_RESULT_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorCanonicalResultMongoStore.js";

console.log("Canonical finalization cross-ledger physical authority court");

const canonicalIndexes=MOVIE_MENTOR_CANONICAL_RESULT_REQUIRED_UNIQUE_INDEXES.map((key,i)=>({name:`canonical_${i}`,key:{...key},unique:true}));
let transactionStarts=0;
const requestedCollections=[];
const store=createMovieMentorCanonicalResultMongoStore({
  mongoModel:{},
  connect:async()=>{},
  executionCollection:{},
  candidateCollection:{},
  readIndexes:async collectionName=>{
    requestedCollections.push(collectionName);
    if(collectionName==="movie_mentor_canonical_result")return canonicalIndexes;
    if(collectionName==="movie_mentor_inference_execution")return[{name:"_id_",key:{_id:1},unique:true}];
    if(collectionName==="movie_mentor_result_candidate")return[{name:"_id_",key:{_id:1},unique:true}];
    assert.fail(`unexpected physical collection: ${collectionName}`);
  },
  startSession:async()=>{
    transactionStarts+=1;
    return{async withTransaction(){},async endSession(){}};
  },
});

await assert.rejects(
  ()=>store.commit({executionId:"execution-cross-ledger"},{expectedProviderEffectRealityRevision:0}),
  error=>error?.code==="MOVIE_MENTOR_CANONICAL_RESULT_CROSS_LEDGER_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "canonical finalization must fail closed when execution/candidate physical identities are absent even though its own five physical identities are healthy",
);
assert.equal(transactionStarts,0,"missing cross-ledger physical identity must fail before Mongo session/finalization transaction authority");
assert.deepEqual(requestedCollections,["movie_mentor_canonical_result","movie_mentor_inference_execution","movie_mentor_result_candidate"],"canonical finalization must independently inspect every physical ledger whose identity it consumes or mutates");
console.log("PASS canonical finalization owns execution and candidate physical identity before cross-ledger transaction authority");
