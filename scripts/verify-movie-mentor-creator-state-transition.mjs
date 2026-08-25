import assert from "node:assert/strict";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";

const memory=new Map();
const key=i=>i.projectId||`session:${i.creatorSessionId}`;
async function read(i){const v=memory.get(key(i));if(!v){const e=new Error("missing");e.code="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND";throw e;}return structuredClone(v);}
async function write(state,{expectedRevision}){const k=key(state),current=memory.get(k);if((current?.revision||0)!==expectedRevision){const e=new Error("conflict");e.code="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT";throw e;}memory.set(k,structuredClone(state));return structuredClone(state);}
const deps={readAuthoritativeTurnSource:read,writeAuthoritativeCreatorState:write};

const first=await applyMovieMentorCreatorStateTransition({projectId:"p1",creatorSessionId:"s1",source:"creator-memory",expectedRevision:0,state:{creatorConfirmedContext:[{key:"genre",value:"mystery"}],memoryContext:{beat:"opening"}}},deps);
assert.equal(first.revision,1);assert.equal(first.creatorStateGeneration,1);assert.equal(first.creatorConfirmedContext[0].value,"mystery");assert.match(first.creatorStateFingerprint,/^[a-f0-9]{64}$/);

const second=await applyMovieMentorCreatorStateTransition({projectId:"p1",creatorSessionId:"s1",source:"creator-journey",expectedRevision:1,state:{projectJourney:{stageId:"story-foundation",taskId:"premise"}}},deps);
assert.equal(second.revision,2);assert.equal(second.creatorConfirmedContext[0].value,"mystery");assert.equal(second.projectJourney.stageId,"story-foundation");

await assert.rejects(()=>applyMovieMentorCreatorStateTransition({projectId:"p1",source:"creator-memory",expectedRevision:1,state:{memoryContext:{bad:true}}},deps),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT");
await assert.rejects(()=>applyMovieMentorCreatorStateTransition({projectId:"p1",source:"specialist-agent",expectedRevision:2,state:{memoryContext:{bad:true}}},deps),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_SOURCE_NOT_AUTHORIZED");
await assert.rejects(()=>applyMovieMentorCreatorStateTransition({projectId:"p1",source:"creator-memory",expectedRevision:2,state:{revision:999,memoryContext:{bad:true}}},deps),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_AUTHORITY_INJECTION");
await assert.rejects(()=>applyMovieMentorCreatorStateTransition({projectId:"p1",source:"creator-memory",expectedRevision:2,state:{}},deps),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_TRANSITION_EMPTY");
console.log("Movie Mentor durable creator state transition verification: PASS");
