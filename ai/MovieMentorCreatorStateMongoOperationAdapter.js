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
const CREATOR_STATE_STORAGE_FIELDS=Object.freeze(["projectId","creatorSessionId","revision","revisionAuthorityReference","creatorStateGeneration","creatorStateFingerprint","creatorAuthorityReference","snapshotReference","creatorConfirmedContext","projectJourney","memoryContext","responseBlueprint","communicationPlan","capturedAt"]);
function serializeCreatorStateForStorage(proposedState){
 const document={};
 for(const field of CREATOR_STATE_STORAGE_FIELDS)if(Object.prototype.hasOwnProperty.call(proposedState,field))document[field]=proposedState[field];
 if(document.capturedAt!==undefined)document.capturedAt=new Date(document.capturedAt);
 if(!document.projectId||!Number.isSafeInteger(document.revision)||document.revision<1||!document.revisionAuthorityReference||!Number.isSafeInteger(document.creatorStateGeneration)||document.creatorStateGeneration<1||!document.creatorStateFingerprint||!document.creatorAuthorityReference||!document.snapshotReference||!(document.capturedAt instanceof Date)||Number.isNaN(document.capturedAt.getTime()))throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","Production creator-state schema authority fields and capturedAt are required.");
 if(!Object.prototype.hasOwnProperty.call(document,"creatorConfirmedContext"))document.creatorConfirmedContext=[];
 if(!Array.isArray(document.creatorConfirmedContext))throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","Confirmed creator context must be an array.");
 for(const field of ["projectJourney","memoryContext","responseBlueprint","communicationPlan"])if(!Object.prototype.hasOwnProperty.call(document,field))document[field]=null;
 return document;
}
function createMongoCreatorStateAtomicAccept({client,states,operations,ownerships}={}){
 if(!client?.startSession||!states?.findOne||!states?.replaceOne||!states?.indexes||!operations?.findOne||!operations?.insertOne||!operations?.indexes)throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_STORAGE_REQUIRED","Mongo transaction client and collections are required.");
 if(!ownerships)throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_STORAGE_REQUIRED","Durable ownership collection is mandatory for atomic creator-state acceptance.");
 if(ownerships.collectionName!=="movie_mentor_project_ownership"||typeof ownerships.updateOne!=="function")throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_STORAGE_REQUIRED","Canonical ownership collection required for durable fencing.");
 return async function atomicAccept({envelope,proposedState,creatorStateMutationAuthority}={}){
  if(typeof envelope?.projectId!=="string"||!envelope.projectId.trim()||!envelope?.principalId||!envelope?.operationId||!envelope?.requestDigest||!proposedState||proposedState.projectId!==envelope.projectId)throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","Operation envelope or proposed state invalid.");
  if(!creatorStateMutationAuthority)throw error("MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED","Server-created current-ownership mutation authority required before Mongo transaction.");
  const admissionProof=await assertMovieMentorCreatorStateMutationAuthority({authority:creatorStateMutationAuthority,projectId:envelope.projectId,source:envelope.source,expectedRevision:envelope.expectedRevision,revision:proposedState.revision,creatorStateGeneration:proposedState.creatorStateGeneration,creatorStateFingerprint:proposedState.creatorStateFingerprint});
  if(admissionProof.principalId!==envelope.principalId)throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","Operation principal differs from authorized owner.");
  await assertOperationIndex(operations);
  await assertProjectIndex(states);
  const storageState=serializeCreatorStateForStorage(proposedState);
  const session=client.startSession();
  try{
   return await session.withTransaction(async()=>{
    const key={projectId:envelope.projectId,principalId:envelope.principalId,operationId:envelope.operationId};
    const previous=await operations.findOne(key,{session});
    if(previous)return previous.requestDigest===envelope.requestDigest?{kind:"replay",result:previous.result}:{kind:"conflict"};
    const current=await states.findOne({projectId:envelope.projectId},{session});
    // Revalidate after the transactional state read, not only before opening the
    // session. Revocation during the read must fail before any durable write.
    // This is a freshness check, not a transactional ownership lock.
    try{
     const currentProof=await assertMovieMentorCreatorStateMutationAuthority({authority:creatorStateMutationAuthority,projectId:envelope.projectId,source:envelope.source,expectedRevision:envelope.expectedRevision,revision:proposedState.revision,creatorStateGeneration:proposedState.creatorStateGeneration,creatorStateFingerprint:proposedState.creatorStateFingerprint});
     if(currentProof.principalId!==envelope.principalId||currentProof.ownershipRef!==admissionProof.ownershipRef||currentProof.ownershipRevision!==admissionProof.ownershipRevision)throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","Ownership authority changed during acceptance.");
     {
      const fenced=await ownerships.updateOne({projectId:envelope.projectId,ownerPrincipalId:envelope.principalId,ownershipReference:currentProof.ownershipRef,ownershipRevision:currentProof.ownershipRevision,status:"active"},{$inc:{creatorStateFenceEpoch:1}},{session});
      if(fenced.matchedCount!==1)throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","Durable ownership changed before transactional creator-state acceptance.");
     }
    }catch(cause){
     if(["MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED","MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_INVALID"].includes(cause?.code))throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","Creator-state ownership changed before transactional mutation.");
     throw cause;
    }
    if((current?.revision??0)!==envelope.expectedRevision)return{kind:"revision-conflict"};
    if(proposedState.revision!==envelope.expectedRevision+1)throw error("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","Proposed state revision must advance exactly once.");
    const now=new Date();
    storageState.createdAt=current?.createdAt??now;
    storageState.updatedAt=now;
    const selector=current?{projectId:envelope.projectId,revision:envelope.expectedRevision}:{projectId:envelope.projectId,revision:{$exists:false}};
    const updated=await states.replaceOne(selector,storageState,{session,upsert:!current});
    if(updated.matchedCount!==1&&updated.upsertedCount!==1)throw error("MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT","Concurrent revision change during transaction.");
    // Final capability freshness check occurs after the physical state write but
    // before operation claim / transaction commit. A denial aborts both writes.
    // The transactional ownership update above remains the durable race fence.
    let finalProof;
    try {
     finalProof=await assertMovieMentorCreatorStateMutationAuthority({authority:creatorStateMutationAuthority,projectId:envelope.projectId,source:envelope.source,expectedRevision:envelope.expectedRevision,revision:proposedState.revision,creatorStateGeneration:proposedState.creatorStateGeneration,creatorStateFingerprint:proposedState.creatorStateFingerprint});
    } catch(cause) {
     if(["MOVIE_MENTOR_CREATOR_STATE_CURRENT_OWNERSHIP_REQUIRED","MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_INVALID"].includes(cause?.code))throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","Creator-state ownership revoked at final write boundary.");
     throw cause;
    }
    if(finalProof.principalId!==envelope.principalId||finalProof.ownershipRef!==admissionProof.ownershipRef||finalProof.ownershipRevision!==admissionProof.ownershipRevision)throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED","Creator-state ownership changed at final write boundary.");
    await operations.insertOne({...key,requestDigest:envelope.requestDigest,result:storageState,committedRevision:proposedState.revision},{session});
    return{kind:"accepted",result:storageState};
   },{readConcern:{level:"snapshot"},writeConcern:{w:"majority"}});
  }finally{await session.endSession();}
 };
}
export{CREATOR_STATE_STORAGE_FIELDS,serializeCreatorStateForStorage,REQUIRED_OPERATION_INDEX,assertOperationIndex,assertProjectIndex,createMongoCreatorStateAtomicAccept};
