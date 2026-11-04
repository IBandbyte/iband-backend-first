import {assertMovieMentorCreatorStateMutationAuthority} from "./MovieMentorCreatorStateMutationAuthority.js";
// Isolated MongoDB transaction adapter for Movie Mentor operation acceptance.
// NOT connected to /state/sync. The caller must provide collections from an
// isolated replica-set test database and must verify the unique indexes first.
// MongoDB transactions require a replica set; no production connection here.
function error(code,message){const e=new Error(message);e.code=code;return e;}
const REQUIRED_OPERATION_INDEX={projectId:1,principalId:1,operationId:1};
function sameIndex(index){return index?.unique===true&&Object.keys(index.key||{}).length===3&&Object.entries(REQUIRED_OPERATION_INDEX).every(([key,value])=>index.key[key]===value);}
async function assertProjectIndex(states){const indexes=await states.indexes();if(!indexes.some(index=>index?.unique===true&&Object.keys(index.key||{}).length===1&&index.key.projectId===1&&(!index.partialFilterExpression||(Object.keys(index.partialFilterExpression).length===1&&Object.keys(index.partialFilterExpression.projectId||{}).length===1&&index.partialFilterExpression.projectId.$type==="string"))))throw error("MOVIE_MENTOR_CREATOR_STATE_PROJECT_INDEX_REQUIRED","Physical unique projectId index is required before transactional creator-state CAS.");}
async function assertOperationIndex(operations){const indexes=await operations.indexes();if(!indexes.some(sameIndex))throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INDEX_REQUIRED","Physical unique project/principal/operation index is required.");}
function createMongoCreatorStateAtomicAccept({client,states,operations}={}){
 if(!client?.startSession||!states?.findOne||!states?.replaceOne||!states?.indexes||!operations?.findOne||!operations?.insertOne||!operations?.indexes)throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_STORAGE_REQUIRED","Mongo transaction client and collections are required.");
 return async function atomicAccept({envelope,proposedState,creatorStateMutationAuthority}={}){
  if(typeof envelope?.projectId!=="string"||!envelope.projectId.trim()||!envelope?.principalId||!envelope?.operationId||!envelope?.requestDigest||!proposedState||proposedState.projectId!==envelope.projectId)throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","Operation envelope or proposed state invalid.");
  if(!creatorStateMutationAuthority)throw error("MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED","Server-created current-ownership mutation authority required before Mongo transaction.");
  await assertMovieMentorCreatorStateMutationAuthority({authority:creatorStateMutationAuthority,projectId:envelope.projectId,source:envelope.source,expectedRevision:envelope.expectedRevision,revision:proposedState.revision,creatorStateGeneration:proposedState.creatorStateGeneration,creatorStateFingerprint:proposedState.creatorStateFingerprint});
  await assertOperationIndex(operations);
  await assertProjectIndex(states);
  const session=client.startSession();
  try{
   return await session.withTransaction(async()=>{
    const key={projectId:envelope.projectId,principalId:envelope.principalId,operationId:envelope.operationId};
    const previous=await operations.findOne(key,{session});
    if(previous)return previous.requestDigest===envelope.requestDigest?{kind:"replay",result:previous.result}:{kind:"conflict"};
    const current=await states.findOne({projectId:envelope.projectId},{session});
    if((current?.revision??0)!==envelope.expectedRevision)return{kind:"revision-conflict"};
    if(proposedState.revision!==envelope.expectedRevision+1)throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","Proposed state revision must advance exactly once.");
    const selector=current?{projectId:envelope.projectId,revision:envelope.expectedRevision}:{projectId:envelope.projectId,revision:{$exists:false}};
    const updated=await states.replaceOne(selector,proposedState,{session,upsert:!current});
    if(updated.matchedCount!==1&&updated.upsertedCount!==1)throw error("MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT","Concurrent revision change during transaction.");
    await operations.insertOne({...key,requestDigest:envelope.requestDigest,result:proposedState,committedRevision:proposedState.revision},{session});
    return{kind:"accepted",result:proposedState};
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  }finally{await session.endSession();}
 };
}
export{REQUIRED_OPERATION_INDEX,assertOperationIndex,assertProjectIndex,createMongoCreatorStateAtomicAccept};
