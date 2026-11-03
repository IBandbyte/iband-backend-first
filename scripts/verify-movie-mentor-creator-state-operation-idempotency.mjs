import assert from "node:assert/strict";
import {applyMovieMentorCreatorStateTransition} from "../ai/MovieMentorCreatorStateTransition.js";
import {MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN as AUTH_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN as PROOF_DOMAIN,MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

// RED-first physical idempotency contract: an operation already accepted must not
// cause another server-side mutation merely because its expected revision advances.
// All state and authority are isolated in memory. No production endpoints or DB.
const projectId="isolated-idempotency-project",principalId="isolated-owner";
const records=new Map();let writes=0;
const read=async({projectId:id})=>{if(!records.has(id))throw Object.assign(new Error("missing"),{code:"MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND"});return structuredClone(records.get(id));};
const write=async(state,{expectedRevision})=>{const prior=records.get(state.projectId);if((prior?.revision||0)!==expectedRevision)throw Object.assign(new Error("conflict"),{code:"MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT"});writes++;records.set(state.projectId,structuredClone(state));return structuredClone(state);};
const authority=Object.freeze({domain:AUTH_DOMAIN,schema:SCHEMA,principalId,projectId,assertCurrentMutation:async target=>Object.freeze({domain:PROOF_DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId,projectId,ownershipRef:"isolated-owner-proof",ownershipRevision:1,source:target.source,expectedRevision:target.expectedRevision,revision:target.revision,creatorStateGeneration:target.creatorStateGeneration,creatorStateFingerprint:target.creatorStateFingerprint})});
const deps={readAuthoritativeTurnSource:read,writeAuthoritativeCreatorState:write,creatorStateMutationAuthority:authority};
const operationId="fixed-client-operation-id";
const first=await applyMovieMentorCreatorStateTransition({projectId,source:"creator-memory",operationId,expectedRevision:0,state:{memoryContext:{projectMemories:[{id:"same-operation"}]}}},deps);
assert.equal(first.revision,1);assert.equal(writes,1);
const replay=()=>applyMovieMentorCreatorStateTransition({projectId,source:"creator-memory",operationId,expectedRevision:1,state:{memoryContext:{projectMemories:[{id:"same-operation"}]}}},deps);
let replayError=null,replayResult=null;
try{replayResult=await replay();}catch(error){replayError=error;}
if(replayResult){
 assert.equal(replayResult.revision,2,"Physical evidence: accepted replay must advance the authoritative revision");
 assert.equal(writes,2,"Physical evidence: accepted replay must have caused a second authoritative write");
 console.error("BOUNDARY RED CONFIRMED: repeated operationId was accepted as revision 2 and caused two authoritative writes in the isolated CAS store.");
}
assert.equal(replayResult,null,"RED: repeated operationId must never produce another authoritative state");
assert.equal(replayError?.code,"MOVIE_MENTOR_CREATOR_STATE_OPERATION_REPLAY","RED: repeated operationId must be rejected by operation-level replay authority");
assert.equal(writes,1,"RED: repeated operationId must not cause a second durable effect");
console.log("GREEN: repeated operationId rejected before another authoritative mutation.");
