import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";

// RED-first: no active creator-state mutation may bypass the atomic operation ledger,
// including legacy requests that omit operationId. No database or HTTP server.
let reads=0,writes=0,authorityChecks=0;
const deps={
 readAuthoritativeTurnSource:async()=>{reads++;throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});},
 writeAuthoritativeCreatorState:async()=>{writes++;return {revision:1};},
 creatorStateMutationAuthority:{assertCurrentMutation:async()=>{authorityChecks++;return {authorized:true};}}
};
let failure;
try{
 await applyMovieMentorCreatorStateTransition({
  projectId:"isolated-legacy-project",source:"creator-memory",expectedRevision:0,
  state:{memoryContext:{projectMemories:[{id:"legacy-without-operation-id"}]}}
 },deps);
}catch(error){failure=error;}
assert.equal(failure?.code,"MOVIE_MENTOR_CREATOR_STATE_ATOMIC_READINESS_REQUIRED",
 "Legacy creator-state mutation without operationId must fail closed before reading or writing.");
assert.equal(reads,0);assert.equal(writes,0);assert.equal(authorityChecks,0);
console.log("GREEN: all legacy non-atomic creator-state mutation attempts fail closed before effects.");
