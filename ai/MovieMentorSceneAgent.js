/**
 * Movie Mentor Scene Agent
 * ------------------------------------------------------------
 * Standalone specialist intelligence for Movie Mentor.
 *
 * STATUS:
 * - Created as a standalone extension agent.
 * - NOT wired into MovieMentorSpecialistExecutor yet.
 * - NOT wired into MovieMentorAgentOrchestrator execution yet.
 * - NOT creator-facing.
 *
 * Core responsibility:
 * Help Movie Mentor understand how a specific story moment can work as a
 * cinematic scene without taking authorship away from the creator.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_SCENE_AGENT_VERSION = "1.0.0";
const SCENE_CONTRACT_VERSION = "1.0.0";
const SCENE_AGENT_ID = "scene";
const SCENE_AUTHORITY = "mentor-provisional";

const SCENE_BEAT_TYPES = Object.freeze([
  "opening-image",
  "arrival",
  "objective",
  "obstacle",
  "conflict",
  "choice",
  "reveal",
  "reversal",
  "escalation",
  "emotional-shift",
  "action",
  "discovery",
  "decision",
  "exit",
  "transition",
  "other",
]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

const SCENE_BEAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: SCENE_BEAT_TYPES },
    description: { type: ["string", "null"] },
    purpose: { type: ["string", "null"] },
    characterId: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["type", "description", "purpose", "characterId", "confidence"],
};

const SCENE_CHARACTER_OBJECTIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    characterId: { type: ["string", "null"] },
    objective: { type: ["string", "null"] },
    obstacle: { type: ["string", "null"] },
    emotionalStateAtStart: { type: ["string", "null"] },
    emotionalStateAtEnd: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["characterId", "objective", "obstacle", "emotionalStateAtStart", "emotionalStateAtEnd", "confidence"],
};

const SCENE_SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestion: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    category: {
      type: "string",
      enum: ["structure", "visual", "dialogue", "conflict", "emotion", "pacing", "transition", "other"],
    },
    createsNewStoryFact: { type: "boolean" },
    requiresCreatorApproval: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["suggestion", "reason", "category", "createsNewStoryFact", "requiresCreatorApproval", "confidence"],
};

const SCENE_AGENT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [SCENE_AGENT_ID] },
    scenePurpose: { type: ["string", "null"] },
    dramaticQuestion: { type: ["string", "null"] },
    openingState: { type: ["string", "null"] },
    closingState: { type: ["string", "null"] },
    characterObjectives: { type: "array", items: SCENE_CHARACTER_OBJECTIVE_SCHEMA },
    beats: { type: "array", items: SCENE_BEAT_SCHEMA },
    conflictAndTension: { type: "array", items: SCENE_SUGGESTION_SCHEMA },
    dialoguePurpose: { type: "array", items: SCENE_SUGGESTION_SCHEMA },
    visualOpportunities: { type: "array", items: SCENE_SUGGESTION_SCHEMA },
    transitionOpportunities: { type: "array", items: SCENE_SUGGESTION_SCHEMA },
    provisionalSuggestions: { type: "array", items: SCENE_SUGGESTION_SCHEMA },
    continuityQuestions: { type: "array", items: SCENE_SUGGESTION_SCHEMA },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: { type: "string" },
        model: { type: ["string", "null"] },
        contractVersion: { type: "string" },
      },
      required: ["source", "model", "contractVersion"],
    },
  },
  required: [
    "agentId",
    "scenePurpose",
    "dramaticQuestion",
    "openingState",
    "closingState",
    "characterObjectives",
    "beats",
    "conflictAndTension",
    "dialoguePurpose",
    "visualOpportunities",
    "transitionOpportunities",
    "provisionalSuggestions",
    "continuityQuestions",
    "confidence",
    "provenance",
  ],
};

const SCENE_AGENT_INSTRUCTIONS = `
You are the internal Scene Agent for iBand Movie Mentor.

You NEVER speak directly to the creator.
You provide scene-specialist intelligence only for later Mentor synthesis.

FOUNDING PRINCIPLE:
THE CREATOR OWNS THE MOVIE.
YOU HELP THE CREATOR SHAPE A SCENE; YOU DO NOT TAKE AUTHORSHIP.

AUTHORITY RULES:
1. Creator-confirmed information outranks every AI inference or suggestion.
2. Existing protected canon must be respected.
3. AI inference is not canon.
4. AI suggestion is not canon.
5. Never silently introduce a new story fact as established truth.
6. Never overwrite creator-confirmed truth.
7. Never advance CreatorJourneyEngine.
8. Never claim the creator decided something they did not decide.
9. Never silently repair a continuity conflict by inventing an explanation.
10. If a scene idea appears to conflict with supplied continuity/canon, flag a continuity question for Mentor synthesis.
11. Suggestions that introduce a new story fact must set createsNewStoryFact=true and requiresCreatorApproval=true.
12. Preserve the creator's language, intent, tone and desired outcome wherever possible.
13. Do not over-engineer a simple scene.
14. Do not add twists, deaths, relationships, secrets, backstory or major plot events unless they were established by the creator or clearly labelled as optional suggestions.
15. Do not confuse cinematic possibility with creator truth.

YOUR SPECIALTY:
- scene purpose
- dramatic question
- opening and closing state
- character objectives
- obstacles and conflict
- dramatic beats
- escalation and reversals
- emotional movement
- discoveries and reveals
- action purpose
- dialogue purpose
- entrances and exits
- visual storytelling opportunities
- pacing
- transitions into and out of the scene
- identifying when a scene may not materially change anything

SCENE QUALITY PRINCIPLE:
A scene usually benefits from movement: something should be learned, changed,
chosen, lost, gained, revealed, escalated, challenged or emotionally shifted.
This is guidance, not a rigid formula. Quiet, atmospheric or observational
scenes may be valid when they serve the creator's intention.

OUTPUT RULES:
- All analysis is Mentor-provisional.
- provisionalSuggestions are possibilities, never decisions.
- continuityQuestions are questions/risks for later Continuity Agent or Mentor handling; do not resolve them yourself by invention.
- Do not write a complete screenplay scene unless the work order explicitly asks for drafting support.
- Do not fabricate canon.
- Return only the required structured output.
`.trim();

function validateSceneWorkOrder(workOrder = {}) {
  const issues = [];

  if (cleanString(workOrder.agentId) !== SCENE_AGENT_ID) {
    issues.push("scene_agent_identity_required");
  }
  if (workOrder.creatorFacing !== false) {
    issues.push("creator_facing_forbidden");
  }
  if (workOrder.mayAdvanceJourney !== false) {
    issues.push("journey_advance_forbidden");
  }
  if (workOrder.mayOverwriteCreatorTruth !== false) {
    issues.push("creator_truth_overwrite_forbidden");
  }
  if (workOrder.mayCreateCanon !== false) {
    issues.push("canon_creation_forbidden");
  }
  if (workOrder.authority !== SCENE_AUTHORITY) {
    issues.push("scene_authority_must_be_mentor_provisional");
  }

  return { valid: issues.length === 0, issues };
}

function validateSceneContribution(candidate = {}) {
  const issues = [];

  if (!candidate || typeof candidate !== "object") {
    return {
      valid: false,
      issues: ["missing_scene_contribution"],
      contribution: null,
    };
  }

  if (cleanString(candidate.agentId) !== SCENE_AGENT_ID) {
    issues.push("scene_agent_identity_mismatch");
  }

  const suggestionGroups = [
    ...asArray(candidate.conflictAndTension),
    ...asArray(candidate.dialoguePurpose),
    ...asArray(candidate.visualOpportunities),
    ...asArray(candidate.transitionOpportunities),
    ...asArray(candidate.provisionalSuggestions),
    ...asArray(candidate.continuityQuestions),
  ];

  for (const item of suggestionGroups) {
    if (item?.createsNewStoryFact === true && item?.requiresCreatorApproval !== true) {
      issues.push("new_story_fact_requires_creator_approval");
    }
  }

  const contribution = {
    agentId: SCENE_AGENT_ID,
    scenePurpose: candidate.scenePurpose || null,
    dramaticQuestion: candidate.dramaticQuestion || null,
    openingState: candidate.openingState || null,
    closingState: candidate.closingState || null,
    characterObjectives: asArray(candidate.characterObjectives),
    beats: asArray(candidate.beats),
    conflictAndTension: asArray(candidate.conflictAndTension),
    dialoguePurpose: asArray(candidate.dialoguePurpose),
    visualOpportunities: asArray(candidate.visualOpportunities),
    transitionOpportunities: asArray(candidate.transitionOpportunities),
    provisionalSuggestions: asArray(candidate.provisionalSuggestions),
    continuityQuestions: asArray(candidate.continuityQuestions),
    confidence: Number(candidate.confidence || 0),
    provenance: {
      ...(candidate.provenance || {}),
      source: "movie-mentor-scene-agent",
      contractVersion: SCENE_CONTRACT_VERSION,
    },
    authority: SCENE_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };

  return {
    valid: issues.length === 0,
    issues,
    contribution,
  };
}

function createSceneWorkOrder({
  stageId = null,
  taskId = null,
  sceneId = null,
  creatorMessage = null,
  semanticIntelligence = {},
  creatorConfirmedContext = [],
  protectedCanon = [],
  storyContext = null,
  characterContext = [],
  continuityContext = null,
  currentScene = null,
  previousScene = null,
  nextScene = null,
  projectJourney = null,
  draftingRequested = false,
  metadata = {},
} = {}) {
  return {
    agentId: SCENE_AGENT_ID,
    purpose:
      "Analyse how the creator's intended story moment can function effectively as a cinematic scene without taking authorship away from the creator.",
    input: {
      stageId: cleanString(stageId) || null,
      taskId: cleanString(taskId) || null,
      sceneId: cleanString(sceneId) || null,
      creatorMessage: cleanString(creatorMessage) || null,
      semanticIntelligence: cloneValue(semanticIntelligence),
      creatorConfirmedContext: cloneValue(asArray(creatorConfirmedContext)),
      protectedCanon: cloneValue(asArray(protectedCanon)),
      storyContext: cloneValue(storyContext),
      characterContext: cloneValue(asArray(characterContext)),
      continuityContext: cloneValue(continuityContext),
      currentScene: cloneValue(currentScene),
      previousScene: cloneValue(previousScene),
      nextScene: cloneValue(nextScene),
      projectJourney: cloneValue(projectJourney),
      draftingRequested: draftingRequested === true,
      metadata:
        metadata && typeof metadata === "object" ? cloneValue(metadata) : {},
    },
    authority: SCENE_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
}

async function executeMovieMentorSceneAgent(workOrder = {}) {
  const preflight = validateSceneWorkOrder(workOrder);

  if (!preflight.valid) {
    const error = new Error(
      "Scene Agent work order failed Movie Mentor authority preflight."
    );
    error.code = "SCENE_WORK_ORDER_INVALID";
    error.validationIssues = preflight.issues;
    throw error;
  }

  const raw = await executeStructuredAI({
    task: "movie-mentor-specialist:scene",
    systemInstructions: SCENE_AGENT_INSTRUCTIONS,
    input: {
      agentId: SCENE_AGENT_ID,
      purpose: workOrder?.purpose || null,
      stageId: workOrder?.input?.stageId || null,
      taskId: workOrder?.input?.taskId || null,
      sceneId: workOrder?.input?.sceneId || null,
      creatorMessage: workOrder?.input?.creatorMessage || null,
      semanticIntelligence: cloneValue(
        workOrder?.input?.semanticIntelligence || {}
      ),
      creatorConfirmedContext: cloneValue(
        workOrder?.input?.creatorConfirmedContext || []
      ),
      protectedCanon: cloneValue(workOrder?.input?.protectedCanon || []),
      storyContext: cloneValue(workOrder?.input?.storyContext || null),
      characterContext: cloneValue(workOrder?.input?.characterContext || []),
      continuityContext: cloneValue(
        workOrder?.input?.continuityContext || null
      ),
      currentScene: cloneValue(workOrder?.input?.currentScene || null),
      previousScene: cloneValue(workOrder?.input?.previousScene || null),
      nextScene: cloneValue(workOrder?.input?.nextScene || null),
      projectJourney: cloneValue(workOrder?.input?.projectJourney || null),
      draftingRequested: workOrder?.input?.draftingRequested === true,
      instruction:
        "Provide scene intelligence only. Preserve creator authority and label every new story possibility as provisional.",
    },
    schema: SCENE_AGENT_OUTPUT_SCHEMA,
    schemaName: "movie_mentor_scene_contribution",
    metadata: {
      sceneAgentVersion: MOVIE_MENTOR_SCENE_AGENT_VERSION,
      sceneContractVersion: SCENE_CONTRACT_VERSION,
      creatorTruthDominates: true,
      aiCannotCreateCanon: true,
    },
  });

  if (!raw?.structured) {
    const error = new Error(
      "Scene Agent provider did not return structured intelligence."
    );
    error.code = "SCENE_STRUCTURED_OUTPUT_INVALID";
    throw error;
  }

  raw.structured.provenance = {
    source: "movie-mentor-scene-agent",
    model: raw?.metadata?.model || null,
    contractVersion: SCENE_CONTRACT_VERSION,
  };

  const validation = validateSceneContribution(raw.structured);

  if (!validation.valid) {
    const error = new Error(
      "Scene Agent contribution failed Movie Mentor authority validation."
    );
    error.code = "SCENE_CONTRIBUTION_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: {
      ...(raw.metadata || {}),
      sceneAgentVersion: MOVIE_MENTOR_SCENE_AGENT_VERSION,
      sceneContractVersion: SCENE_CONTRACT_VERSION,
      authority: {
        creatorTruthDominates: true,
        aiCannotCreateCanon: true,
        mayAdvanceJourney: false,
        maySpeakDirectlyToCreator: false,
        mayOverwriteCreatorTruth: false,
        mentorMustSynthesize: true,
      },
    },
  };
}

function getSceneAgentManifest() {
  return {
    id: SCENE_AGENT_ID,
    name: "Movie Mentor Scene Agent",
    version: MOVIE_MENTOR_SCENE_AGENT_VERSION,
    contractVersion: SCENE_CONTRACT_VERSION,
    status: "standalone-not-wired",
    purpose:
      "Provide cinematic scene-construction intelligence while preserving creator authorship and established canon.",
    authority: SCENE_AUTHORITY,
    creatorFacing: false,
    vendorNeutral: true,
    providerExecution: "StructuredAIProviderClient",
    capabilities: [
      "scene-purpose",
      "dramatic-question",
      "character-objectives",
      "conflict-and-tension",
      "scene-beats",
      "emotional-movement",
      "reveals-and-reversals",
      "dialogue-purpose",
      "visual-storytelling",
      "pacing",
      "entrances-and-exits",
      "scene-transitions",
      "continuity-risk-identification",
    ],
    restrictions: [
      "cannot-create-canon",
      "cannot-overwrite-creator-truth",
      "cannot-promote-ai-suggestion-to-canon",
      "cannot-advance-journey",
      "cannot-speak-directly-to-creator",
      "cannot-silently-resolve-continuity-conflicts",
      "requires-mentor-synthesis",
    ],
  };
}

export {
  MOVIE_MENTOR_SCENE_AGENT_VERSION,
  SCENE_CONTRACT_VERSION,
  SCENE_AGENT_ID,
  SCENE_AUTHORITY,
  SCENE_BEAT_TYPES,
  SCENE_BEAT_SCHEMA,
  SCENE_CHARACTER_OBJECTIVE_SCHEMA,
  SCENE_SUGGESTION_SCHEMA,
  SCENE_AGENT_OUTPUT_SCHEMA,
  SCENE_AGENT_INSTRUCTIONS,
  validateSceneWorkOrder,
  validateSceneContribution,
  createSceneWorkOrder,
  executeMovieMentorSceneAgent,
  getSceneAgentManifest,
};

export default executeMovieMentorSceneAgent;
