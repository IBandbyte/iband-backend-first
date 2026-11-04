import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// RED-first later-revision replay court. All storage is isolated in memory.
const projectId="isolated-revision-two",principalId="owner";
let writes=0,current=null;const operations=new Map();
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"owner-v1",ownershipRevision:1,...target})};
const atomicAccept=async({envelope,proposedState,creatorStateMutationAuthority})=>{
 assert.equal(creatorStateMutationAuthority,authority);
 assert.equal(envelope.principalId,principalId);
 const key=envelope.projectId+":"+envelope.principalId+":"+envelope.operationId;
 const existing=operations.get(key);
 if(existing)return existing.digest===envelope.requestDigest?{kind:"replay",result:structuredClone(existing.result)}:{kind:"conflict"};
 if((current?.revision??0)!==envelope.expectedRevision)return{kind:"revision-conflict"};
 assert.equal(proposedState.revision,envelope.expectedRevision+1);
 current=structuredClone(proposedState);writes++;
 operations.set(key,{digest:envelope.requestDigest,result:structuredClone(current)});
 return{kind:"accepted",result:structuredClone(current)};
};
const deps={principalId,creatorStateMutationAuthority:authority,atomicAcceptCreatorStateOperation:atomicAccept,readAuthoritativeTurnSource:async()=>{if(!current)throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});return structuredClone(current);},writeAuthoritativeCreatorState:async()=>{throw Error("RED: legacy writer invoked");}};
const first={projectId,source:"creator-memory",operationId:"initial",expectedRevision:0,state:{memoryContext:{step:1}}};
assert.equal((await applyMovieMentorCreatorStateTransition(first,deps)).revision,1);
const second={projectId,source:"creator-memory",operationId:"second",expectedRevision:1,state:{memoryContext:{step:2}}};
assert.equal((await applyMovieMentorCreatorStateTransition(second,deps)).revision,2,"RED: later-revision atomic acceptance required");
assert.equal((await applyMovieMentorCreatorStateTransition(second,deps)).revision,2,"RED: lost acknowledgement at revision two must replay original");
assert.equal(writes,2,"RED: replay cannot create revision three");
assert.equal(current.revision,2);
console.log("GREEN: later revision atomic acceptance and lost-ack replay preserve exactly two durable effects.");
