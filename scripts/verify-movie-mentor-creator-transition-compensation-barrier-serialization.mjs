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
  // Model the production Creator-state CAS exactly: identity + revision only,
  // followed by $set of writeDocument(state), which includes the stale barrier.
  if(durable.projectId!==state.projectId||durable.revision!==expectedRevision){
    const error=new Error("revision conflict");error.code="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT";throw error;
  }
  durable={...durable,...structuredClone(state)};
  return structuredClone(durable);
}

const written=await applyMovieMentorCreatorStateTransition({
  projectId:"project-343",creatorSessionId:"session-343",source:"creator-workspace",
  expectedRevision:8,state:{projectJourney:{stageId:"characters"}}
},{
  readAuthoritativeTurnSource,
  writeAuthoritativeCreatorState:productionSemanticsWrite,
  creatorStateMutationAuthority:mutationAuthority
});

assert.equal(compensationCommitted,true);
assert.equal(written.revision,9);
assert.equal(
  written.compensationBarrierRevision,4,
  "RED: a Creator transition built before compensation must not overwrite the compensation barrier committed before its authoritative write"
);

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
assert.match(storeSource,/findOneAndUpdate\(\{\.\.\.identity,revision:expected\},\{\$set:doc\}/,
  "court must remain bound to the production revision-only CAS shape");
assert.match(storeSource,/compensationBarrierRevision:n\(state\.compensationBarrierRevision\)\?\?0/,
  "court must remain bound to production writing the carried barrier through $set");

console.log("GREEN: Creator-state transition cannot erase a compensation barrier committed after transition read/proof and before durable write.");
console.log("LAW: THE AUTHORITATIVE CREATOR-STATE WRITE MUST SERIALIZE AGAINST THE PHYSICAL COMPENSATION BARRIER IT CARRIES.");
