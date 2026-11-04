import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// RED-first isolated transition-to-atomic-operation integration. No production storage.
const projectId="isolated-transition-atomic",principalId="owner";
let revision=0,writes=0;const claims=new Map();
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"owner-v1",ownershipRevision:1,...target})};
const read=async()=>{if(!revision)throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});return structuredClone(lastState);};
let lastState=null;
const atomicAccept=async({envelope,proposedState,creatorStateMutationAuthority})=>{
 assert.equal(creatorStateMutationAuthority,authority,"RED: atomic boundary must receive server mutation authority");
 assert.equal(envelope.principalId,principalId,"RED: principal must be server-bound");
 assert.equal(envelope.projectId,projectId);
 assert.ok(envelope.operationId);
 assert.equal(envelope.expectedRevision,0);
 const key=envelope.projectId+":"+envelope.principalId+":"+envelope.operationId;
 if(claims.has(key))return{kind:"replay",result:structuredClone(claims.get(key))};
 assert.equal(revision,envelope.expectedRevision);
 revision++;writes++;lastState=structuredClone(proposedState);claims.set(key,structuredClone(lastState));
 return{kind:"accepted",result:structuredClone(lastState)};
};
const input={projectId,source:"creator-memory",operationId:"client-op-1",expectedRevision:0,state:{memoryContext:{projectMemories:[{id:"one"}]}}};
const deps={readAuthoritativeTurnSource:read,creatorStateMutationAuthority:authority,atomicAcceptCreatorStateOperation:atomicAccept,principalId,writeAuthoritativeCreatorState:async()=>{throw Error("RED: legacy write path must not run when atomic operation integration is selected");}};
const first=await applyMovieMentorCreatorStateTransition(input,deps);
assert.equal(first.revision,1);
assert.equal(writes,1);
const retry=await applyMovieMentorCreatorStateTransition(input,deps);
assert.equal(retry.revision,1,"RED: identical lost-ack retry must return committed revision");
assert.equal(writes,1,"RED: identical operation must not commit twice");
assert.equal(claims.size,1);
console.log("GREEN: isolated transition uses atomic operation authority and recovers lost acknowledgement without duplicate write.");
