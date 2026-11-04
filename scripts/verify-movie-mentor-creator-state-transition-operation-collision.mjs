import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// RED-first: same operation ID with a different payload must conflict even
// after the original operation committed and the authoritative revision moved.
const projectId="isolated-operation-collision",principalId="owner";
let current=null,writes=0;const claims=new Map();
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"owner-v1",ownershipRevision:1,...target})};
const accept=async({envelope,proposedState})=>{
 const key=envelope.projectId+":"+envelope.principalId+":"+envelope.operationId,previous=claims.get(key);
 if(previous)return previous.digest===envelope.requestDigest?{kind:"replay",result:structuredClone(previous.result)}:{kind:"conflict"};
 if((current?.revision??0)!==envelope.expectedRevision)return{kind:"revision-conflict"};
 current=structuredClone(proposedState);writes++;claims.set(key,{digest:envelope.requestDigest,result:structuredClone(current)});
 return{kind:"accepted",result:structuredClone(current)};
};
const deps={principalId,creatorStateMutationAuthority:authority,atomicAcceptCreatorStateOperation:accept,readAuthoritativeTurnSource:async()=>{if(!current)throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});return structuredClone(current);},writeAuthoritativeCreatorState:async()=>{throw Error("legacy writer forbidden");}};
const first={projectId,source:"creator-memory",operationId:"shared",expectedRevision:0,state:{memoryContext:{text:"original"}}};
assert.equal((await applyMovieMentorCreatorStateTransition(first,deps)).revision,1);
let conflict=null;try{await applyMovieMentorCreatorStateTransition({...first,state:{memoryContext:{text:"forged"}}},deps);}catch(e){conflict=e;}
assert.equal(conflict?.code,"MOVIE_MENTOR_CREATOR_STATE_OPERATION_ID_CONFLICT","RED: same ID with different payload must conflict");
assert.equal(writes,1,"RED: collision must not write");
assert.equal((await applyMovieMentorCreatorStateTransition(first,deps)).revision,1,"RED: exact retry must replay original");
assert.equal(writes,1);
console.log("GREEN: conflicting operation ID denied; identical retry replayed without second write.");
