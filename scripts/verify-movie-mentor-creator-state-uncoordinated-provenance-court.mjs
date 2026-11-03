import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {
 MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,
 MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,
 MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA,
} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// Physical transition examination with isolated in-memory authoritative store.
// No HTTP network, MongoDB, production endpoint or production mutation.
const projectId="isolated-uncoordinated-provenance-project";
const records=new Map();
let writes=0,proofs=0;
const read=async({projectId:id})=>{
 const value=records.get(id);
 if(!value)throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});
 return structuredClone(value);
};
const write=async(state,{expectedRevision})=>{
 const current=records.get(state.projectId);
 if((current?.revision||0)!==expectedRevision)throw Object.assign(new Error("conflict"),{code:"MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT"});
 writes++;
 records.set(state.projectId,structuredClone(state));
 return structuredClone(state);
};
const authority=Object.freeze({
 domain:AUTH_DOMAIN,schema:SCHEMA,principalId:"isolated-owner",projectId,
 assertCurrentMutation:async target=>{
  proofs++;
  return Object.freeze({
   domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,
   principalId:"isolated-owner",projectId,ownershipRef:"isolated-current-owner",
   ownershipRevision:1,source:target.source,expectedRevision:target.expectedRevision,
   revision:target.revision,creatorStateGeneration:target.creatorStateGeneration,
   creatorStateFingerprint:target.creatorStateFingerprint,
  });
 },
});
const deps={readAuthoritativeTurnSource:read,writeAuthoritativeCreatorState:write,creatorStateMutationAuthority:authority};
const uncoordinated={projectId,source:"creator-memory",expectedRevision:0,
 state:{memoryContext:{projectMemories:[{id:"injected",projectId,metadata:{uncoordinatedWriteMarker:"forwarded-without-lock"}}]}}};
const accepted=await applyMovieMentorCreatorStateTransition(uncoordinated,deps);
assert.equal(accepted.revision,1);
assert.equal(records.get(projectId)?.memoryContext?.projectMemories?.[0]?.metadata?.uncoordinatedWriteMarker,"forwarded-without-lock");
assert.equal(proofs,1);
assert.equal(writes,1);
console.log("BOUNDARY RED CONFIRMED: actual backend creator-state transition accepted and stored a correctly owned, current-revision input carrying an uncoordinated-local-write marker; no client lock provenance was required.");
await assert.rejects(()=>applyMovieMentorCreatorStateTransition(uncoordinated,deps),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT");
assert.equal(writes,1,"Stale revision must not mutate authoritative state");
console.log("GREEN: stale revision was refused without another write.");
await assert.rejects(()=>applyMovieMentorCreatorStateTransition({...uncoordinated,expectedRevision:1,
 state:{revision:999,memoryContext:{bad:true}}},deps),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_AUTHORITY_INJECTION");
assert.equal(writes,1);
console.log("GREEN: client server-authority-field injection was refused.");
await assert.rejects(()=>applyMovieMentorCreatorStateTransition({...uncoordinated,expectedRevision:1},
 {...deps,creatorStateMutationAuthority:null}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_REQUIRED");
assert.equal(writes,1);
console.log("GREEN: absent current mutation authority was refused.");
console.log("LIMITATION: isolated transition with injected current-owner proof and in-memory store, not live HTTP or MongoDB; backend production acceptance is not certified.");
