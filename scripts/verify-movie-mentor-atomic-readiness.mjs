import assert from "node:assert/strict";
import {createMovieMentorCreatorStateAtomicReadiness} from "../ai/MovieMentorCreatorStateAtomicReadiness.js";

const index=(key,partial)=>({key,unique:true,...(partial?{partialFilterExpression:partial}:{})});
const stateIndex=index({projectId:1},{projectId:{$type:"string"}});
const operationIndex=index({projectId:1,principalId:1,operationId:1});
let sessions=0;
const client={startSession(){sessions++;return{};}};
const collection=(name,indexes)=>({collectionName:name,indexes:async()=>indexes,findOne:async()=>null,replaceOne:async()=>({}),insertOne:async()=>({})});
const states=collection("movie_mentor_creator_state",[stateIndex]),operations=collection("movie_mentor_creator_state_operations",[operationIndex]);
const ready=createMovieMentorCreatorStateAtomicReadiness({client,states,operations});
assert.equal(typeof(await ready()),"function");
assert.equal(sessions,0,"Readiness must not start a transaction or mutate storage.");
for(const [reason,overrides] of [
 ["missing-operation-index",{operations:collection("movie_mentor_creator_state_operations",[])}],
 ["wrong-state-index",{states:collection("movie_mentor_creator_state",[])}],
 ["wrong-ledger-collection",{operations:collection("other_collection",[operationIndex])}],
 ["wrong-state-collection",{states:collection("other_state",[stateIndex])}],
 ["missing-client",{client:null}]
]){
 await assert.rejects(()=>createMovieMentorCreatorStateAtomicReadiness({client,states,operations,...overrides})(),()=>true,reason+" must fail closed");
}
console.log("GREEN: atomic creator-state readiness verifies both physical indexes and collection identities without writes.");
