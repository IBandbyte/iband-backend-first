import assert from "node:assert/strict";
import { createMovieMentorProviderOperationMongoStore } from "../ai/MovieMentorProviderOperationMongoStore.js";
const input={providerCallId:"call-A",executionId:"exec-A",slotId:"slot-A",task:"story",providerTarget:{provider:"openai",adapter:"responses",route:"responses.create",fingerprint:"target-A",recoveryMode:"response-id"},providerModel:{provider:"openai",model:"gpt-test"},boundAt:"2035-01-01T00:00:00.000Z"};
const wrong={domain:"iband.movie-mentor.provider-operation-store",schema:3,...input,providerCallId:"call-OTHER",executionId:"exec-OTHER"};
const mongoModel={collection:{async indexes(){return [{key:{providerCallId:1},unique:true},{key:{executionId:1,slotId:1,task:1},unique:true}]}},async create(){return structuredClone(wrong)}};
const store=createMovieMentorProviderOperationMongoStore({mongoModel});
let failure=null;try{await store.bindOperation(input)}catch(error){failure=error}
assert.ok(failure,"provider operation create must reject returned evidence from a different immutable call universe");
assert.equal(failure.code,"MOVIE_MENTOR_PROVIDER_OPERATION_CREATE_RETURN_BINDING_INVALID");
console.log("Movie Mentor provider operation create return binding authority: GREEN");
console.log("LAW: A SUCCESSFUL PROVIDER-OPERATION MINT RETURN MUST BIND THE EXACT REQUESTED CALL UNIVERSE.");
