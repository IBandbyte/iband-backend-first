import {createHash} from "node:crypto";

const OPERATION_LEDGER_VERSION="1.0.0";
function fail(code,message){const error=new Error(message);error.code=code;return error;}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object")return Object.keys(value).sort().reduce((out,key)=>(out[key]=stable(value[key]),out),{});return value;}
function requireString(value,name){if(typeof value!=="string"||!value.trim()||value.length>256)throw fail("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID",name+" must be a nonempty bounded string.");return value.trim();}
function canonicalOperation({principalId,projectId,operationId,source,expectedRevision,state}={}){
 const identity={principalId:requireString(principalId,"principalId"),projectId:requireString(projectId,"projectId"),operationId:requireString(operationId,"operationId"),source:requireString(source,"source")};
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw fail("MOVIE_MENTOR_CREATOR_STATE_EXPECTED_REVISION_REQUIRED","Expected revision must be a nonnegative safe integer.");
 if(!state||typeof state!=="object"||Array.isArray(state))throw fail("MOVIE_MENTOR_CREATOR_STATE_OPERATION_INVALID","State patch must be an object.");
 const requestDigest=createHash("sha256").update(JSON.stringify(stable({...identity,expectedRevision,state}))).digest("hex");
 return Object.freeze({...identity,expectedRevision,requestDigest});
}

// Storage adapter MUST atomically compare the project revision, claim the operation key,
// and persist the next creator state plus accepted result. This function never performs
// a non-atomic preflight read or treats client-supplied fingerprints as authority.
async function acceptCreatorStateOperation({operation,proposedState,assertCurrentOwnership,atomicAccept}={}){
 if(typeof assertCurrentOwnership!=="function"||typeof atomicAccept!=="function")throw fail("MOVIE_MENTOR_CREATOR_STATE_OPERATION_AUTHORITY_REQUIRED","Current ownership and atomic durable storage authority are required.");
 const envelope=canonicalOperation(operation);
 const ownership=await assertCurrentOwnership({principalId:envelope.principalId,projectId:envelope.projectId});
 if(ownership?.authorized!==true||ownership.principalId!==envelope.principalId||ownership.projectId!==envelope.projectId)throw fail("MOVIE_MENTOR_CREATOR_STATE_OWNER_REQUIRED","Current project ownership is required.");
 const outcome=await atomicAccept({envelope,proposedState});
 if(!outcome||!["accepted","replay","conflict","revision-conflict"].includes(outcome.kind))throw fail("MOVIE_MENTOR_CREATOR_STATE_OPERATION_STORAGE_INVALID","Atomic storage returned an invalid result.");
 if(outcome.kind==="conflict")throw fail("MOVIE_MENTOR_CREATOR_STATE_OPERATION_ID_CONFLICT","Operation ID was previously used with different request content.");
 if(outcome.kind==="revision-conflict")throw fail("MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT","Expected revision is no longer current.");
 if(!outcome.result||outcome.result.projectId!==envelope.projectId)throw fail("MOVIE_MENTOR_CREATOR_STATE_OPERATION_STORAGE_INVALID","Atomic storage returned an invalid accepted result.");
 return Object.freeze({kind:outcome.kind,result:outcome.result});
}
export{OPERATION_LEDGER_VERSION,canonicalOperation,acceptCreatorStateOperation};
