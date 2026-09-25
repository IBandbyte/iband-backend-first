import assert from "node:assert/strict";
import fs from "node:fs";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";

console.log("5A.44 — Creator transition / compensation barrier serialization authority");

const current={
  projectId:"project-343",creatorSessionId:"session-343",revision:8,
  revisionAuthorityReference:"revision-8",creatorStateGeneration:8,
  creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:"creator-8",
  snapshotReference:"snapshot-8",creatorConfirmedContext:[],
  projectJourney:{stageId:"story"},memoryContext:null,responseBlueprint:null,
  communicationPlan:null,compensationBarrierRevision:3,
  capturedAt:"2035-01-01T00:00:00.000Z"
};

let durable=structuredClone(current);
let compensationCommitted=false;
const mutationAuthority={
  domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,
  principalId:"creator-343",projectId:"project-343",
  async assertCurrentMutation(input){
    return {domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,
      authorized:true,currentOwnershipVerified:true,principalId:"creator-343",
      projectId:"project-343",ownershipRef:"ownership-343",ownershipRevision:1,...input};
  }
};

async function readAuthoritativeTurnSource(){return structuredClone(durable);}

async function productionSemanticsWrite(state,{expectedRevision}){
  // Exact reachable interleaving under test:
  // transition already read barrier 3 and minted its mutation proof;
  // compensation commits its physical touch without changing semantic revision 8.
  if(!compensationCommitted){
    durable.compensationBarrierRevision+=1;
    compensationCommitted=true;
  }
  // Model the repaired production CAS: semantic revision plus the exact
  // physical compensation barrier carried by the transition.
  if(durable.projectId!==state.projectId||durable.revision!==expectedRevision||durable.compensationBarrierRevision!==state.compensationBarrierRevision){
    const error=new Error("revision/barrier conflict");error.code="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT";throw error;
  }
  durable={...durable,...structuredClone(state)};
  return structuredClone(durable);
}

await assert.rejects(
  () => applyMovieMentorCreatorStateTransition({
  projectId:"project-343",creatorSessionId:"session-343",source:"creator-workspace",
  expectedRevision:8,state:{projectJourney:{stageId:"characters"}}
},{
  readAuthoritativeTurnSource,
  writeAuthoritativeCreatorState:productionSemanticsWrite,
  creatorStateMutationAuthority:mutationAuthority
  }),
  error => error?.code==="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT",
  "stale Creator transition must lose after compensation advances the physical barrier"
);
assert.equal(compensationCommitted,true);
assert.equal(durable.revision,8,"failed stale transition must not advance semantic revision");
assert.equal(durable.compensationBarrierRevision,4,"failed stale transition must preserve committed compensation barrier");

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
assert.match(storeSource,/findOneAndUpdate\(\{\.\.\.identity,revision:expected,\.\.\.\(doc\.compensationBarrierRevision===0\?\{\$or:\[\{compensationBarrierRevision:0\},\{compensationBarrierRevision:\{\$exists:false\}\}\]\}:\{compensationBarrierRevision:doc\.compensationBarrierRevision\}\)\},\{\$set:doc\}/,
  "authoritative Creator-state CAS must bind the compensation barrier, admitting physical absence only for legacy logical zero");
assert.match(storeSource,/compensationBarrierRevision:n\(state\.compensationBarrierRevision\)\?\?0/,
  "court must remain bound to production writing the carried barrier through $set");

console.log("GREEN: Creator-state transition cannot erase a compensation barrier committed after transition read/proof and before durable write.");
console.log("LAW: THE AUTHORITATIVE CREATOR-STATE WRITE MUST SERIALIZE AGAINST THE PHYSICAL COMPENSATION BARRIER IT CARRIES.");
