import assert from "node:assert/strict";
import fs from "node:fs";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";

console.log("5A.45 — Creator-state legacy compensation barrier compatibility");

const legacyPhysical={
  projectId:"project-344",creatorSessionId:"session-344",revision:8,
  revisionAuthorityReference:"revision-8",creatorStateGeneration:8,
  creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:"creator-8",
  snapshotReference:"snapshot-8",creatorConfirmedContext:[],
  projectJourney:{stageId:"story"},memoryContext:null,responseBlueprint:null,
  communicationPlan:null,capturedAt:"2035-01-01T00:00:00.000Z"
};
assert.equal(Object.hasOwn(legacyPhysical,"compensationBarrierRevision"),false,
  "fixture must remain a physically pre-barrier Creator-state document");

let durable=structuredClone(legacyPhysical);
const normalize=row=>({...structuredClone(row),compensationBarrierRevision:
  Number.isSafeInteger(row.compensationBarrierRevision)&&row.compensationBarrierRevision>=0
    ? row.compensationBarrierRevision : 0});

const mutationAuthority={
  domain:"iband.movie-mentor.creator-state-mutation-authority",schema:1,
  principalId:"creator-344",projectId:"project-344",
  async assertCurrentMutation(input){
    return {domain:"iband.movie-mentor.creator-state-mutation-proof",schema:1,
      authorized:true,currentOwnershipVerified:true,principalId:"creator-344",
      projectId:"project-344",ownershipRef:"ownership-344",ownershipRevision:1,...input};
  }
};

async function readAuthoritativeTurnSource(){return normalize(durable);}

async function productionSemanticsWrite(state,{expectedRevision}){
  // Model Mongo equality semantics of the repaired #343 CAS:
  // { revision: expected, compensationBarrierRevision: state.compensationBarrierRevision }.
  // A physically missing field does not equal numeric zero.
  const barrierMatches=durable.compensationBarrierRevision===state.compensationBarrierRevision
    || (state.compensationBarrierRevision===0&&!Object.hasOwn(durable,"compensationBarrierRevision"));
  if(durable.projectId!==state.projectId||durable.revision!==expectedRevision||!barrierMatches){
    const error=new Error("revision/barrier conflict");
    error.code="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT";
    throw error;
  }
  durable={...durable,...structuredClone(state)};
  return normalize(durable);
}

const written=await applyMovieMentorCreatorStateTransition({
  projectId:"project-344",creatorSessionId:"session-344",source:"creator-workspace",
  expectedRevision:8,state:{projectJourney:{stageId:"characters"}}
},{
  readAuthoritativeTurnSource,
  writeAuthoritativeCreatorState:productionSemanticsWrite,
  creatorStateMutationAuthority:mutationAuthority
});

assert.equal(written.revision,9,
  "legacy Creator-state rows normalized to barrier zero must remain authoritatively writable after the barrier fence deploys");
assert.equal(written.compensationBarrierRevision,0,
  "first legitimate post-upgrade transition should materialize the legacy zero barrier without inventing compensation");

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
assert.match(storeSource,/compensationBarrierRevision:n\(doc\.compensationBarrierRevision\)\?\?0/,
  "court must remain bound to production normalizing physically missing barrier as logical zero");
assert.match(storeSource,/doc\.compensationBarrierRevision===0\?\{\$or:\[\{compensationBarrierRevision:0\},\{compensationBarrierRevision:\{\$exists:false\}\}\]\}:\{compensationBarrierRevision:doc\.compensationBarrierRevision\}/,
  "legacy compatibility may admit missing only for logical zero while nonzero barriers remain exact");

console.log("GREEN: pre-barrier Creator-state documents remain writable while preserving the #343 compensation serialization fence.");
console.log("LAW: LEGACY MISSING BARRIER MAY REPRESENT ZERO, BUT MUST NEVER WEAKEN NONZERO COMPENSATION SERIALIZATION.");

{
  const nonzeroPhysical={...legacyPhysical,compensationBarrierRevision:4};
  const staleState={...normalize(nonzeroPhysical),revision:9,compensationBarrierRevision:3};
  const barrierMatches=nonzeroPhysical.compensationBarrierRevision===staleState.compensationBarrierRevision
    || (staleState.compensationBarrierRevision===0&&!Object.hasOwn(nonzeroPhysical,"compensationBarrierRevision"));
  assert.equal(barrierMatches,false,"legacy compatibility must never let a stale nonzero compensation barrier match");
  console.log("✓ nonzero compensation barrier remains exact; missing-field compatibility is zero-only");
}
