import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";
// RED-first: an injected principal cannot borrow another owner's mutation capability.
const projectId="isolated-principal-binding",owner="owner-A",impostor="owner-B";
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId:owner,projectId,assertCurrentMutation:async target=>({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:owner,projectId,ownershipRef:"owner-A-ref",ownershipRevision:1,...target})};
let called=0;
const deps={principalId:impostor,creatorStateMutationAuthority:authority,atomicAcceptCreatorStateOperation:async()=>{called++;return{kind:"accepted",result:{revision:1}};},readAuthoritativeTurnSource:async()=>{throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});},writeAuthoritativeCreatorState:async()=>{throw Error("legacy writer forbidden");}};
let failure=null;
try{await applyMovieMentorCreatorStateTransition({projectId,source:"creator-memory",operationId:"impostor-op",expectedRevision:0,state:{memoryContext:{x:1}}},deps);}catch(error){failure=error;}
assert.ok(failure,"RED: mismatched principal and mutation capability must be rejected");
assert.equal(called,0,"RED: mismatched principal must never reach atomic acceptance");
console.log("GREEN: principal/capability mismatch rejected before atomic acceptance.");
