import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// RED-first: no active creator-state mutation may bypass the atomic operation ledger,
// including legacy requests that omit operationId. No database or HTTP server.
let reads=0,writes=0,authorityChecks=0;
const deps={
 readAuthoritativeTurnSource:async()=>{reads++;throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});},
 writeAuthoritativeCreatorState:async()=>{writes++;return {revision:1};},
 creatorStateMutationAuthority:{domain:AUTH_DOMAIN,schema:SCHEMA,principalId:"isolated-principal",projectId:"isolated-legacy-project",assertCurrentMutation:async target=>{authorityChecks++;return {domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:"isolated-principal",projectId:"isolated-legacy-project",ownershipRef:"isolated-proof",ownershipRevision:1,source:target.source,expectedRevision:target.expectedRevision,revision:target.revision,creatorStateGeneration:target.creatorStateGeneration,creatorStateFingerprint:target.creatorStateFingerprint};}}
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
