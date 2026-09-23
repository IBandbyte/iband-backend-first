import assert from "node:assert/strict";
import { buildTurnEnvelopeFromDurableState } from "../ai/MovieMentorTurnRuntime.js";
import { validateIntelligence } from "../ai/MovieMentorSemanticInterpreter.js";

console.log("ROUND EIGHT — legacy non-decision creator-truth rehydration provenance court");

const forgedLegacyTruth={key:"movie.genre",value:"forged-horror",authority:"creator",confidenceSource:"creator-confirmed"};
const state={
  projectId:"legacy-truth-project",
  creatorSessionId:"legacy-truth-session",
  revision:11,
  revisionAuthorityReference:"legacy-revision-11",
  creatorStateGeneration:7,
  creatorStateFingerprint:"b".repeat(64),
  creatorAuthorityReference:"legacy-authority-7",
  snapshotReference:"legacy-snapshot-11",
  creatorConfirmedContext:[forgedLegacyTruth],
  projectJourney:null,
  memoryContext:null,
  responseBlueprint:null,
  communicationPlan:null,
  capturedAt:"2026-08-01T12:00:00.000Z"
};

assert.throws(
  ()=>buildTurnEnvelopeFromDurableState({creatorMessage:"Carry on.",state}),
  error=>error?.code==="MOVIE_MENTOR_LEGACY_CREATOR_TRUTH_REHYDRATION_PROVENANCE_REQUIRED",
  "pre-hardening non-decision creator truth must not become current authority from durable storage without provenance re-establishment."
);

// Reachability witness: if admitted, the legacy item becomes live creator truth and
// constrains semantic interpretation as if the Creator had genuinely confirmed it.
const envelope=(()=>{
  const clean={...state,creatorConfirmedContext:[]};
  const base=buildTurnEnvelopeFromDurableState({creatorMessage:"Carry on.",state:clean});
  return {...base,creatorConfirmedContext:[forgedLegacyTruth]};
})();
const candidate={
  understoodContext:[],
  provisionalContext:[{key:"movie.genre",value:"comedy",evidence:"model inference",confidenceSource:"model-provisional"}],
  unresolvedContext:[],
  clarificationNeeded:[],
  readyToAdvance:true,
  recommendedStageId:null,
  recommendedTaskId:null,
  nextAction:null,
  resumeNote:null
};
const validated=validateIntelligence(candidate,{creatorConfirmedContext:envelope.creatorConfirmedContext});
assert.equal(validated.intelligence.provisionalContext.length,0,"danger witness must prove forged legacy truth constrains live semantics if rehydrated.");

console.log("Movie Mentor legacy non-decision creator-truth rehydration provenance authority verification: PASS");
