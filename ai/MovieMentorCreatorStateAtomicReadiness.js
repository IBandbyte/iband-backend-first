import {assertOperationIndex,assertProjectIndex,createMongoCreatorStateAtomicAccept} from "./MovieMentorCreatorStateMongoOperationAdapter.js";

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
  return createMongoCreatorStateAtomicAccept({client,states,operations,ownerships});
 };
}
export{CREATOR_STATE_COLLECTION,CREATOR_STATE_OPERATION_COLLECTION,createMovieMentorCreatorStateAtomicReadiness};
