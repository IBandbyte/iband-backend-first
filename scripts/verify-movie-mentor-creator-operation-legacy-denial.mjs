import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";

// RED-first: a supplied operationId is not sufficient idempotency authority.
// No atomic ledger means no safe way to prove replay; deny before read/write.
let reads=0,writes=0,checks=0;
const authority={principalId:"isolated-principal",projectId:"isolated-project",assertCurrentMutation:async()=>{checks++;return{authorized:true};}};
const deps={
 readAuthoritativeTurnSource:async()=>{reads++;throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});},
 writeAuthoritativeCreatorState:async()=>{writes++;return{revision:1};},
 creatorStateMutationAuthority:authority
};
let failure;
try{
 await applyMovieMentorCreatorStateTransition({
  projectId:"isolated-project",source:"creator-memory",
  operationId:"client-replay-identifier",expectedRevision:0,
  state:{memoryContext:{projectMemories:[{id:"example"}]}}
 },deps);
}catch(error){failure=error;}
assert.equal(failure?.code,"MOVIE_MENTOR_CREATOR_STATE_ATOMIC_READINESS_REQUIRED",
 "Operation-bearing legacy writes must fail closed without an atomic ledger.");
assert.equal(reads,0,"No legacy read before rejection.");
assert.equal(writes,0,"No legacy write before rejection.");
assert.equal(checks,0,"No authority evaluation before rejection.");
console.log("GREEN: operation-bearing legacy path denies before any state or authority effects.");
