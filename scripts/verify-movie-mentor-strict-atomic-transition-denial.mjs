import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";

// RED-first behavioural court: a production-strict caller cannot fall back
// to the legacy direct writer even when valid mutation authority is supplied.
// No Mongo, HTTP server, production credentials, or durable writes.
let reads=0,writes=0;
const input={projectId:"strict-denial-project",source:"creator-memory",expectedRevision:0,state:{memoryContext:{test:true}}};
const deps={
 requireAtomicCreatorStateOperation:true,
 readAuthoritativeTurnSource:async()=>{reads++;const e=new Error("not found");e.code="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND";throw e;},
 writeAuthoritativeCreatorState:async()=>{writes++;return{revision:1};}
};
await assert.rejects(
 ()=>applyMovieMentorCreatorStateTransition(input,deps),
 e=>e?.code==="MOVIE_MENTOR_CREATOR_STATE_ATOMIC_READINESS_REQUIRED",
 "Strict mutation without atomic operation adapter must fail closed."
);
assert.equal(reads,0,"Strict denial must precede state reads.");
assert.equal(writes,0,"Strict denial must precede all direct writes.");
console.log("GREEN: strict creator-state mutation rejects missing atomic adapter before read or write.");
