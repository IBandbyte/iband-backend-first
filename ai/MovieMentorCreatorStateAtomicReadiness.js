import {assertOperationIndex,assertProjectIndex,createMongoCreatorStateAtomicAccept} from "./MovieMentorCreatorStateMongoOperationAdapter.js";

async function assertOwnershipIndex(ownerships){
 if(typeof ownerships?.indexes!=="function")throw readinessError("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_INDEX_REQUIRED","Physical canonical ownership index inspection required before creator gateway mounting.");
 let indexes;
 try{indexes=await ownerships.indexes();}catch{throw readinessError("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_INDEX_REQUIRED","Physical canonical ownership index inspection unavailable.");}
 if(!Array.isArray(indexes)||!indexes.some(index=>index?.unique===true&&Object.keys(index.key||{}).length===1&&index.key.projectId===1))throw readinessError("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_INDEX_REQUIRED","Physical unique projectId ownership index required before creator gateway mounting.");
}

const CREATOR_STATE_COLLECTION="movie_mentor_creator_state";
const CREATOR_STATE_OPERATION_COLLECTION="movie_mentor_creator_state_operations";
function readinessError(code,message){const e=new Error(message);e.code=code;return e;}
function createMovieMentorCreatorStateAtomicReadiness({client,states,operations,ownerships}={}){
 return async function assertAtomicReadiness(){
  if(typeof client?.startSession!=="function"||!states||!operations||!ownerships||typeof states.indexes!=="function"||typeof operations.indexes!=="function")throw readinessError("MOVIE_MENTOR_CREATOR_STATE_ATOMIC_READINESS_REQUIRED","Atomic readiness requires transaction client and both physical collections.");
  if(states.collectionName!==CREATOR_STATE_COLLECTION||operations.collectionName!==CREATOR_STATE_OPERATION_COLLECTION)throw readinessError("MOVIE_MENTOR_CREATOR_STATE_ATOMIC_COLLECTION_MISMATCH","Atomic readiness requires exact canonical state and operation collection identities.");
  if(ownerships.collectionName!=="movie_mentor_project_ownership")throw readinessError("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_COLLECTION_MISMATCH","Canonical durable ownership collection required.");
  await assertProjectIndex(states);
  await assertOperationIndex(operations);
  await assertOwnershipIndex(ownerships);
  return createMongoCreatorStateAtomicAccept({client,states,operations,ownerships});
 };
}
export{CREATOR_STATE_COLLECTION,CREATOR_STATE_OPERATION_COLLECTION,createMovieMentorCreatorStateAtomicReadiness};
