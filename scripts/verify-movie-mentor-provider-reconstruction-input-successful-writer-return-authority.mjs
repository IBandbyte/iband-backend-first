import assert from "node:assert/strict";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
console.log("Movie Mentor provider reconstruction-input successful-writer return authority court");
const call={providerCallId:"call-A",executionId:"exec-A",slotId:"semantic",task:"movie-mentor-semantic"};
let operation={domain:"iband.movie-mentor.provider-operation-reality",schema:1,...call,providerTarget:{provider:"generic-http",adapter:"generic-http",routeFingerprint:"a".repeat(64),recoveryMode:"known-response-id-retrieval"},providerModel:"model-A",boundAt:"2036-01-01T00:00:00.000Z",reconstructionInputDigest:null,reconstructionInput:null,reconstructionInputBoundAt:null};
const store={
 async readOperation(){return structuredClone(operation)},
 async bindOperation(){return structuredClone(operation)},
 async bindReconstructionInput(input){
   // Adversarial store claims the successful first write but returns a different payload/time
   // under the requested digest. Higher authority must not grant evidence for those bytes.
   operation={...operation,reconstructionInputDigest:input.reconstructionInputDigest,reconstructionInput:{universe:"OTHER"},reconstructionInputBoundAt:"2036-01-01T00:00:09.000Z"};
   return structuredClone(operation);
 }
};
const authority=createMovieMentorProviderOperationAuthority({store,now:()=>new Date("2036-01-01T00:00:01.000Z")});
await assert.rejects(()=>authority.bindReconstructionInput({providerCall:call,reconstructionInput:{universe:"REQUESTED"}}),error=>["MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_INTEGRITY_INVALID","MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_CONFLICT"].includes(error?.code),"successful first binder must reject returned durable bytes that do not reproduce the requested digest");
console.log("GREEN: successful reconstruction-input binding cannot return different durable bytes.");
