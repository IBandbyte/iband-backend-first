import assert from "node:assert/strict";
import {
  RECOMMENDATION_REFERENCE_DOMAIN,
  RECOMMENDATION_REFERENCE_SCHEMA,
  selectCurrentRecommendationReference,
} from "../ai/MovieMentorRecommendationReferenceControl.js";
import { resolveContinuationReferences } from "../ai/MovieMentorContinuationReferenceControl.js";
import { buildCreatorDecisionCandidate } from "../ai/MovieMentorCreatorDecisionAuthority.js";

function recommendationMemory({ id, projectId = "p1", turnRevision, nextStep, createdAt }) {
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
        creatorSessionId: "session-a",
        authority: "mentor-advisory",
        creatorConfirmed: false,
        mayCreateCanon: false,
        mayAdvanceJourney: false,
        recommendation: {
          recommendedStageId: "story",
          recommendedTaskId: id === "A" ? "escape" : "objective-after-escape",
          recommendedNextStep: nextStep,
          explanation: "Advisory Journey planning only.",
          alternatives: [],
        },
        provenance: { turnRevision },
        lifecycle: { current: true, supersededByRecommendationId: null },
        createdAt,
      },
    },
  };
}

const A = recommendationMemory({ id: "A", turnRevision: 10, nextStep: "develop the escape itself", createdAt: "2026-08-26T20:00:00.000Z" });
const B = recommendationMemory({ id: "B", turnRevision: 11, nextStep: "develop Maya's objective after the escape", createdAt: "2026-08-26T20:01:00.000Z" });
const memoryContext = { projectMemories: [A, B], conversations: [], sessionHandoffs: [] };

let selected = selectCurrentRecommendationReference({ memoryContext, projectId: "p1" });
assert.equal(selected.status, "resolved");
assert.equal(selected.recommendationId, "B");
assert.equal(selected.evidence.creatorConfirmed, false);
assert.equal(selected.evidence.mayCreateCanon, false);
assert.equal(selected.evidence.mayAdvanceJourney, false);

let resolution = resolveContinuationReferences({ creatorMessage: "Yes, do that.", projectId: "p1", memoryContext, creatorConfirmedContext: [] });
assert.equal(resolution.hasMaterialAmbiguity, false);
assert.equal(resolution.references.length, 1);
assert.equal(resolution.references[0].type, "journey-recommendation");
assert.equal(resolution.references[0].resolvedValue.recommendationId, "B");
assert.match(resolution.references[0].resolvedValue.recommendedNextStep, /Maya's objective/i);

const semantic = {
  understoodContext: [],
  provisionalContext: [],
  unresolvedContext: [],
  clarificationNeeded: [],
  readyToAdvance: true,
  continuationReferences: resolution.references,
};
let decision = buildCreatorDecisionCandidate({ creatorMessage: "Yes, do that.", semanticIntelligence: semantic, projectId: "p1", actorRole: "creator" });
assert.equal(decision.status, "candidate");
assert.equal(decision.candidate.authority, "creator-explicit");
assert.equal(decision.candidate.reference.type, "journey-recommendation");
assert.equal(decision.candidate.value.recommendationId, "B");

resolution = resolveContinuationReferences({ creatorMessage: "No, not that.", projectId: "p1", memoryContext, creatorConfirmedContext: [] });
assert.equal(resolution.hasMaterialAmbiguity, false);
assert.equal(resolution.references[0].resolvedValue.recommendationId, "B");
decision = buildCreatorDecisionCandidate({ creatorMessage: "No, not that.", semanticIntelligence: { ...semantic, continuationReferences: resolution.references }, projectId: "p1", actorRole: "creator" });
assert.equal(decision.status, "none");
assert.equal(decision.reason, "no_explicit_creator_commitment");

const competingB = recommendationMemory({ id: "B2", turnRevision: 11, nextStep: "stay on the escape beat", createdAt: "2026-08-26T20:01:30.000Z" });
const competing = { projectMemories: [A, B, competingB], conversations: [], sessionHandoffs: [] };
selected = selectCurrentRecommendationReference({ memoryContext: competing, projectId: "p1" });
assert.equal(selected.status, "ambiguous");
resolution = resolveContinuationReferences({ creatorMessage: "Yes, do that.", projectId: "p1", memoryContext: competing, creatorConfirmedContext: [] });
assert.equal(resolution.hasMaterialAmbiguity, true);
assert.equal(resolution.references[0].status, "ambiguous");

const wrongProject = { projectMemories: [recommendationMemory({ id: "X", projectId: "p2", turnRevision: 99, nextStep: "wrong project", createdAt: "2026-08-26T20:02:00.000Z" })], conversations: [], sessionHandoffs: [] };
selected = selectCurrentRecommendationReference({ memoryContext: wrongProject, projectId: "p1" });
assert.equal(selected.status, "none");

const restarted = JSON.parse(JSON.stringify(memoryContext));
selected = selectCurrentRecommendationReference({ memoryContext: restarted, projectId: "p1" });
assert.equal(selected.status, "resolved");
assert.equal(selected.recommendationId, "B");

const staleOnly = { projectMemories: [A, { ...B, metadata: { ...B.metadata, recommendationReference: { ...B.metadata.recommendationReference, lifecycle: { current: false, supersededByRecommendationId: "C" } } } }], conversations: [], sessionHandoffs: [] };
selected = selectCurrentRecommendationReference({ memoryContext: staleOnly, projectId: "p1" });
assert.equal(selected.status, "resolved");
assert.equal(selected.recommendationId, "A");

console.log("Movie Mentor Journey recommendation reference verification: PASS");
