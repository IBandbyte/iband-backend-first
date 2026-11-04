import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// RED-first: a supplied operationId is not sufficient idempotency authority.
// No atomic ledger means no safe way to prove replay; deny before read/write.
let reads=0,writes=0,checks=0;
const authority={domain:AUTH_DOMAIN,schema:SCHEMA,principalId:"isolated-principal",projectId:"isolated-project",assertCurrentMutation:async target=>{checks++;return{domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:"isolated-principal",projectId:"isolated-project",ownershipRef:"isolated-proof",ownershipRevision:1,source:target.source,expectedRevision:target.expectedRevision,revision:target.revision,creatorStateGeneration:target.creatorStateGeneration,creatorStateFingerprint:target.creatorStateFingerprint};}};
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
