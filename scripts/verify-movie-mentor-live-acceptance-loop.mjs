import assert from "node:assert/strict";
import { orchestrateMovieMentorTurn } from "../ai/MovieMentorTurnOrchestrator.js";
import { resolveContinuationReferences } from "../ai/MovieMentorContinuationReferenceControl.js";
import {
  RECOMMENDATION_REFERENCE_DOMAIN,
  RECOMMENDATION_REFERENCE_SCHEMA,
  selectCurrentRecommendationReference,
} from "../ai/MovieMentorRecommendationReferenceControl.js";

const projectId = "door-11d4-project";
const creatorSessionId = "door-11d4-session";

function clone(value){return JSON.parse(JSON.stringify(value));}
function recommendationMemory({ id, revision, taskId, nextStep, current = true, supersededByRecommendationId = null }){
  const createdAt = new Date(1_800_000_000_000 + revision * 1000).toISOString();
  return {
    id: `pm-${id}`,
    projectId,
    memoryKey: `journey-recommendation:${id}`,
    content: nextStep,
    createdAt,
    updatedAt: createdAt,
    metadata: {
      projectId,
      recommendationReference: {
        domain: RECOMMENDATION_REFERENCE_DOMAIN,
        schema: RECOMMENDATION_REFERENCE_SCHEMA,
        recommendationId: id,
        projectId,
        creatorSessionId,
        authority: "mentor-advisory",
        creatorConfirmed: false,
        mayCreateCanon: false,
        mayAdvanceJourney: false,
        recommendation: {
          recommendedStageId: "story-direction",
          recommendedTaskId: taskId,
          recommendedNextStep: nextStep,
          explanation: "Journey advisory recommendation.",
          alternatives: [],
        },
        provenance: { turnRevision: revision },
        lifecycle: { current, supersededByRecommendationId },
        createdAt,
      },
    },
  };
}

function retire(memory, replacementId){
  const timestamp = new Date().toISOString();
  for (const item of memory.projectMemories) {
    const ref = item?.metadata?.recommendationReference;
    if (ref?.domain === RECOMMENDATION_REFERENCE_DOMAIN && ref.lifecycle?.current === true && ref.recommendationId !== replacementId) {
      ref.lifecycle = { current: false, supersededByRecommendationId: replacementId, supersededAt: timestamp };
      item.updatedAt = timestamp;
    }
  }
}

let durableState = {
  revision: 10,
  creatorStateGeneration: 3,
  revisionAuthorityReference: "revision:10",
  creatorStateFingerprint: "creator-state:10",
  creatorAuthorityReference: "creator-authority:10",
  snapshotReference: "snapshot:10",
  capturedAt: new Date().toISOString(),
  projectId,
  creatorSessionId,
  creatorConfirmedContext: [],
};

const memoryContext = {
  projectMemories: [recommendationMemory({ id: "A", revision: 10, taskId: "escape", nextStep: "develop the escape itself" })],
  conversations: [],
  sessionHandoffs: [],
};

function authoritativeEnvelope(message, memory = memoryContext){
  return {
    projectId,
    creatorSessionId,
    creatorMessage: message,
    creatorConfirmedContext: clone(durableState.creatorConfirmedContext),
    projectJourney: { currentStageId: "story-direction" },
    memoryContext: clone(memory),
    responseBlueprint: {},
    communicationPlan: {},
  };
}

async function verifyTurnContext(){
  return {
    verified: true,
    revision: durableState.revision,
    snapshotFingerprint: `snapshot-fingerprint:${durableState.revision}`,
    snapshotReference: durableState.snapshotReference,
    revisionAuthorityReference: durableState.revisionAuthorityReference,
    creatorState: { generation: durableState.creatorStateGeneration, fingerprint: durableState.creatorStateFingerprint },
  };
}

async function readAuthoritativeTurnSource(){ return clone(durableState); }
async function applyMovieMentorCreatorStateTransition({ expectedRevision, state }){
  assert.equal(expectedRevision, durableState.revision);
  durableState = {
    ...durableState,
    revision: durableState.revision + 1,
    creatorStateGeneration: durableState.creatorStateGeneration + 1,
    revisionAuthorityReference: `revision:${durableState.revision + 1}`,
    creatorStateFingerprint: `creator-state:${durableState.revision + 1}`,
    creatorAuthorityReference: `creator-authority:${durableState.revision + 1}`,
    snapshotReference: `snapshot:${durableState.revision + 1}`,
    capturedAt: new Date().toISOString(),
    creatorConfirmedContext: clone(state.creatorConfirmedContext),
  };
  return { revision: durableState.revision };
}

async function interpretSemantics(){
  return {
    structured: {
      movieJourneyIntelligence: {
        understoodContext: [], provisionalContext: [], unresolvedContext: [], clarificationNeeded: [],
        readyToAdvance: true,
        recommendedStageId: "story-direction",
        recommendedTaskId: durableState.revision === 10 ? "escape" : "objective-after-escape",
        nextAction: { label: durableState.revision === 10 ? "Develop the escape itself" : "Develop Maya's objective after the escape" },
      },
    },
    mentorDraft: "Continue with the selected recommendation.",
  };
}

function obedienceClaims(envelope){
  return (envelope?.references || []).map((reference) => ({
    referenceId: reference.referenceId,
    status: "obeyed",
    resolvedValueDigest: reference.resolvedValueDigest,
  }));
}

async function executeSpecialistPlan(plan){
  const envelope = plan.workOrders[0]?.input?.continuationObedienceEnvelope;
  const claims = obedienceClaims(envelope);
  return {
    contributions: [
      { agentId: "story", continuationObedienceClaims: clone(claims) },
      { agentId: "character", continuationObedienceClaims: clone(claims) },
      {
        agentId: "continuity",
        continuityConsequenceEnvelope: { status: "consistent", requiresClarification: false, derivedConstraints: [], conflicts: [], unresolvedQuestions: [] },
      },
    ],
  };
}

async function synthesizeResponse(input){
  return { success: true, text: "Done. Here is the refreshed next recommendation.", continuationObedienceClaims: obedienceClaims(input.continuationObedienceEnvelope) };
}

const deps = {
  verifyTurnContext,
  readAuthoritativeTurnSource,
  applyMovieMentorCreatorStateTransition,
  interpretSemantics,
  executeSpecialistPlan,
  synthesizeResponse,
};

// A is the sole live recommendation at N.
let selected = selectCurrentRecommendationReference({ memoryContext, projectId });
assert.equal(selected.status, "resolved");
assert.equal(selected.recommendationId, "A");

// Creator accepts "that": exact continuation resolution must bind to A, then commit N+1.
const first = await orchestrateMovieMentorTurn({ message: "Yes, do that.", authoritativeTurnContext: authoritativeEnvelope("Yes, do that.") }, deps);
assert.equal(first.metadata.continuationResolution.references.length, 1);
assert.equal(first.metadata.continuationResolution.references[0].resolvedValue.recommendationId, "A");
assert.equal(first.creatorDecision.status, "committed");
assert.equal(first.creatorDecision.candidate.value.recommendationId, "A");
assert.equal(first.turnContextProof.revision, 10);
assert.equal(first.postCommitCreatorAuthority.revision, 11);
assert.ok(first.postCommitCreatorAuthority.currentCreatorTruth.some(item => item?.value?.recommendationId === "A"));
assert.equal(durableState.revision, 11);

// Refreshed Journey reasoning at N+1 produces B; A is explicitly retired.
retire(memoryContext, "B");
memoryContext.projectMemories.push(recommendationMemory({ id: "B", revision: first.postCommitCreatorAuthority.revision, taskId: "objective-after-escape", nextStep: "develop Maya's objective after the escape" }));
selected = selectCurrentRecommendationReference({ memoryContext, projectId });
assert.equal(selected.status, "resolved");
assert.equal(selected.recommendationId, "B");
const retiredA = memoryContext.projectMemories.find(item => item.metadata.recommendationReference.recommendationId === "A").metadata.recommendationReference;
assert.equal(retiredA.lifecycle.current, false);
assert.equal(retiredA.lifecycle.supersededByRecommendationId, "B");

// Process death/reload: persisted lifecycle is the only evidence allowed to resurrect.
const reloadedMemoryContext = JSON.parse(JSON.stringify(memoryContext));
selected = selectCurrentRecommendationReference({ memoryContext: reloadedMemoryContext, projectId });
assert.equal(selected.status, "resolved");
assert.equal(selected.recommendationId, "B");
const reloadResolution = resolveContinuationReferences({ creatorMessage: "Yes, do that.", projectId, memoryContext: reloadedMemoryContext, creatorConfirmedContext: clone(durableState.creatorConfirmedContext) });
assert.equal(reloadResolution.hasMaterialAmbiguity, false);
assert.equal(reloadResolution.references.length, 1);
assert.equal(reloadResolution.references[0].resolvedValue.recommendationId, "B");
assert.notEqual(reloadResolution.references[0].resolvedValue.recommendationId, "A");

// Second live acceptance must bind to B and can never resolve retired A.
const second = await orchestrateMovieMentorTurn({ message: "Yes, do that.", authoritativeTurnContext: authoritativeEnvelope("Yes, do that.", reloadedMemoryContext) }, deps);
assert.equal(second.metadata.continuationResolution.references.length, 1);
assert.equal(second.metadata.continuationResolution.references[0].resolvedValue.recommendationId, "B");
assert.notEqual(second.metadata.continuationResolution.references[0].resolvedValue.recommendationId, "A");
assert.equal(second.creatorDecision.status, "committed");
assert.equal(second.creatorDecision.candidate.value.recommendationId, "B");
assert.equal(second.turnContextProof.revision, 11);
assert.equal(second.postCommitCreatorAuthority.revision, 12);
assert.ok(second.postCommitCreatorAuthority.currentCreatorTruth.some(item => item?.value?.recommendationId === "B"));
assert.equal(durableState.revision, 12);

console.log("Movie Mentor Door 11D4 uninterrupted live acceptance loop: PASS");
