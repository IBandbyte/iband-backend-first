/**
 * Movie Mentor Visual + Cinematic Agent
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
 * Help Movie Mentor think visually and cinematically without taking
 * directorial authorship away from the creator or inventing canon.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_VISUAL_CINEMATIC_AGENT_VERSION = "1.0.0";
const VISUAL_CINEMATIC_CONTRACT_VERSION = "1.0.0";
const VISUAL_CINEMATIC_AGENT_ID = "visual-cinematic";
const VISUAL_CINEMATIC_AUTHORITY = "mentor-provisional";

const VISUAL_CATEGORIES = Object.freeze([
  "composition", "blocking", "camera", "movement", "lighting", "colour",
  "production-design", "location", "costume", "prop", "visual-motif",
  "visual-metaphor", "environment", "transition", "silence", "action",
  "point-of-view", "scale", "depth", "reveal", "other",
]);

function cleanString(value) { return typeof value === "string" ? value.trim() : ""; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function cloneValue(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }

const VISUAL_OBSERVATION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: VISUAL_CATEGORIES },
    observation: { type: ["string", "null"] },
    sceneId: { type: ["string", "null"] },
    characterId: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "observation", "sceneId", "characterId", "reason", "confidence"],
};

const VISUAL_SUGGESTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: VISUAL_CATEGORIES },
    suggestion: { type: ["string", "null"] },
    purpose: { type: ["string", "null"] },
    sceneId: { type: ["string", "null"] },
    createsNewStoryFact: { type: "boolean" },
    requiresCreatorApproval: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "suggestion", "purpose", "sceneId", "createsNewStoryFact", "requiresCreatorApproval", "confidence"],
};

const VISUAL_CINEMATIC_AGENT_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [VISUAL_CINEMATIC_AGENT_ID] },
    visualIntentRead: { type: ["string", "null"] },
    observations: { type: "array", items: VISUAL_OBSERVATION_SCHEMA },
    compositionOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    blockingOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    cameraOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    lightingAndEnvironmentOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    visualStorytellingOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    motifAndMetaphorOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    transitionOpportunities: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    provisionalSuggestions: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    continuityQuestions: { type: "array", items: VISUAL_SUGGESTION_SCHEMA },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: {
      type: "object", additionalProperties: false,
      properties: { source: { type: "string" }, model: { type: ["string", "null"] }, contractVersion: { type: "string" } },
      required: ["source", "model", "contractVersion"],
    },
  },
  required: ["agentId", "visualIntentRead", "observations", "compositionOpportunities", "blockingOpportunities", "cameraOpportunities", "lightingAndEnvironmentOpportunities", "visualStorytellingOpportunities", "motifAndMetaphorOpportunities", "transitionOpportunities", "provisionalSuggestions", "continuityQuestions", "confidence", "provenance"],
};

const VISUAL_CINEMATIC_AGENT_INSTRUCTIONS = `
You are the internal Visual + Cinematic Agent for iBand Movie Mentor.
You NEVER speak directly to the creator. You provide specialist intelligence only for later Mentor synthesis.

FOUNDING PRINCIPLE:
THE CREATOR OWNS THE MOVIE'S VISUAL LANGUAGE. YOU EXPAND CINEMATIC POSSIBILITY; YOU DO NOT DIRECT THE CREATOR'S FILM FOR THEM.

AUTHORITY RULES:
1. Creator-confirmed visual intention outranks every AI preference.
2. Existing protected canon must be respected.
3. AI inference and suggestion are not canon.
4. Never overwrite creator-confirmed truth or silently create story facts.
5. Never advance CreatorJourneyEngine.
6. Camera suggestions are possibilities, not mandatory shot lists.
7. Never assume expensive equipment, locations, effects or production scale are available.
8. When production constraints are supplied, respect them and favour achievable visual ideas.
9. Do not equate cinematic quality with expensive production.
10. Do not over-direct scenes that benefit from simplicity.
11. Do not prescribe fashionable visual techniques merely to appear cinematic.
12. Visual storytelling should serve story, character, emotion and creator intent.
13. Never invent props, costume changes, injuries, locations or environmental facts as established canon.
14. If a visual possibility introduces a new story fact, set createsNewStoryFact=true and requiresCreatorApproval=true.
15. If supplied material conflicts with established visual or physical continuity, flag a continuity question rather than inventing a repair.
16. Preserve unconventional visual language when intentional.
17. Avoid stereotypes when discussing costume, colour, location or visual identity.

YOUR SPECIALTY:
- visual storytelling
- composition and framing possibilities
- character blocking and spatial relationships
- camera position and movement possibilities
- point of view
- foreground/background storytelling
- lighting and atmosphere
- colour intention
- production design
- locations and environment
- props and costume as visual storytelling when already established
- visual motifs and metaphors
- entrances, exits and reveals
- action readability
- scale and depth
- cinematic transitions
- opportunities to replace unnecessary exposition with image or behaviour
- production-aware visual alternatives

QUALITY PRINCIPLE:
A cinematic image earns its place by serving the movie. A locked camera can be as powerful as elaborate movement. Silence can be as visual as action. The goal is not more shots; it is clearer and more expressive storytelling.

OUTPUT RULES:
All analysis is Mentor-provisional. Suggestions are possibilities, never decisions. Do not create canon. Do not produce a mandatory shot list unless explicitly requested by the work order. Return only the required structured output.
`.trim();

function validateVisualCinematicWorkOrder(workOrder = {}) {
  const issues = [];
  if (cleanString(workOrder.agentId) !== VISUAL_CINEMATIC_AGENT_ID) issues.push("visual_cinematic_agent_identity_required");
  if (workOrder.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (workOrder.mayAdvanceJourney !== false) issues.push("journey_advance_forbidden");
  if (workOrder.mayOverwriteCreatorTruth !== false) issues.push("creator_truth_overwrite_forbidden");
  if (workOrder.mayCreateCanon !== false) issues.push("canon_creation_forbidden");
  if (workOrder.authority !== VISUAL_CINEMATIC_AUTHORITY) issues.push("visual_cinematic_authority_must_be_mentor_provisional");
  return { valid: issues.length === 0, issues };
}

function validateVisualCinematicContribution(candidate = {}) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") return { valid: false, issues: ["missing_visual_cinematic_contribution"], contribution: null };
  if (cleanString(candidate.agentId) !== VISUAL_CINEMATIC_AGENT_ID) issues.push("visual_cinematic_agent_identity_mismatch");
  const suggestionGroups = [
    ...asArray(candidate.compositionOpportunities), ...asArray(candidate.blockingOpportunities),
    ...asArray(candidate.cameraOpportunities), ...asArray(candidate.lightingAndEnvironmentOpportunities),
    ...asArray(candidate.visualStorytellingOpportunities), ...asArray(candidate.motifAndMetaphorOpportunities),
    ...asArray(candidate.transitionOpportunities), ...asArray(candidate.provisionalSuggestions),
    ...asArray(candidate.continuityQuestions),
  ];
  for (const item of suggestionGroups) {
    if (item?.createsNewStoryFact === true && item?.requiresCreatorApproval !== true) issues.push("new_story_fact_requires_creator_approval");
  }
  const contribution = {
    agentId: VISUAL_CINEMATIC_AGENT_ID,
    visualIntentRead: candidate.visualIntentRead || null,
    observations: asArray(candidate.observations),
    compositionOpportunities: asArray(candidate.compositionOpportunities),
    blockingOpportunities: asArray(candidate.blockingOpportunities),
    cameraOpportunities: asArray(candidate.cameraOpportunities),
    lightingAndEnvironmentOpportunities: asArray(candidate.lightingAndEnvironmentOpportunities),
    visualStorytellingOpportunities: asArray(candidate.visualStorytellingOpportunities),
    motifAndMetaphorOpportunities: asArray(candidate.motifAndMetaphorOpportunities),
    transitionOpportunities: asArray(candidate.transitionOpportunities),
    provisionalSuggestions: asArray(candidate.provisionalSuggestions),
    continuityQuestions: asArray(candidate.continuityQuestions),
    confidence: Number(candidate.confidence || 0),
    provenance: { ...(candidate.provenance || {}), source: "movie-mentor-visual-cinematic-agent", contractVersion: VISUAL_CINEMATIC_CONTRACT_VERSION },
    authority: VISUAL_CINEMATIC_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
  return { valid: issues.length === 0, issues, contribution };
}

function createVisualCinematicWorkOrder({ stageId = null, taskId = null, sceneId = null, creatorMessage = null, semanticIntelligence = {}, creatorConfirmedContext = [], protectedCanon = [], storyContext = null, characterContext = [], sceneContext = null, continuityContext = null, dialogueContext = null, creatorVisualIntent = null, productionConstraints = {}, shotListRequested = false, projectJourney = null, metadata = {} } = {}) {
  return {
    agentId: VISUAL_CINEMATIC_AGENT_ID,
    purpose: "Analyse visual and cinematic storytelling possibilities while preserving creator authorship, canon and production intent.",
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
      sceneContext: cloneValue(sceneContext),
      continuityContext: cloneValue(continuityContext),
      dialogueContext: cloneValue(dialogueContext),
      creatorVisualIntent: cloneValue(creatorVisualIntent),
      productionConstraints: productionConstraints && typeof productionConstraints === "object" ? cloneValue(productionConstraints) : {},
      shotListRequested: shotListRequested === true,
      projectJourney: cloneValue(projectJourney),
      metadata: metadata && typeof metadata === "object" ? cloneValue(metadata) : {},
    },
    authority: VISUAL_CINEMATIC_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
}

async function executeMovieMentorVisualCinematicAgent(workOrder = {}) {
  const preflight = validateVisualCinematicWorkOrder(workOrder);
  if (!preflight.valid) {
    const error = new Error("Visual + Cinematic Agent work order failed Movie Mentor authority preflight.");
    error.code = "VISUAL_CINEMATIC_WORK_ORDER_INVALID";
    error.validationIssues = preflight.issues;
    throw error;
  }

  const raw = await executeStructuredAI({
    task: "movie-mentor-specialist:visual-cinematic",
    systemInstructions: VISUAL_CINEMATIC_AGENT_INSTRUCTIONS,
    input: {
      agentId: VISUAL_CINEMATIC_AGENT_ID,
      purpose: workOrder?.purpose || null,
      stageId: workOrder?.input?.stageId || null,
      taskId: workOrder?.input?.taskId || null,
      sceneId: workOrder?.input?.sceneId || null,
      creatorMessage: workOrder?.input?.creatorMessage || null,
      semanticIntelligence: cloneValue(workOrder?.input?.semanticIntelligence || {}),
      creatorConfirmedContext: cloneValue(workOrder?.input?.creatorConfirmedContext || []),
      protectedCanon: cloneValue(workOrder?.input?.protectedCanon || []),
      storyContext: cloneValue(workOrder?.input?.storyContext || null),
      characterContext: cloneValue(workOrder?.input?.characterContext || []),
      sceneContext: cloneValue(workOrder?.input?.sceneContext || null),
      continuityContext: cloneValue(workOrder?.input?.continuityContext || null),
      dialogueContext: cloneValue(workOrder?.input?.dialogueContext || null),
      creatorVisualIntent: cloneValue(workOrder?.input?.creatorVisualIntent || null),
      productionConstraints: cloneValue(workOrder?.input?.productionConstraints || {}),
      shotListRequested: workOrder?.input?.shotListRequested === true,
      projectJourney: cloneValue(workOrder?.input?.projectJourney || null),
      instruction: "Provide visual and cinematic intelligence only. Treat every directorial possibility as provisional and preserve creator authority.",
    },
    schema: VISUAL_CINEMATIC_AGENT_OUTPUT_SCHEMA,
    schemaName: "movie_mentor_visual_cinematic_contribution",
    metadata: {
      visualCinematicAgentVersion: MOVIE_MENTOR_VISUAL_CINEMATIC_AGENT_VERSION,
      visualCinematicContractVersion: VISUAL_CINEMATIC_CONTRACT_VERSION,
      creatorTruthDominates: true,
      aiCannotCreateCanon: true,
      cameraSuggestionsAreOptional: true,
    },
  });

  if (!raw?.structured) {
    const error = new Error("Visual + Cinematic Agent provider did not return structured intelligence.");
    error.code = "VISUAL_CINEMATIC_STRUCTURED_OUTPUT_INVALID";
    throw error;
  }

  raw.structured.provenance = { source: "movie-mentor-visual-cinematic-agent", model: raw?.metadata?.model || null, contractVersion: VISUAL_CINEMATIC_CONTRACT_VERSION };
  const validation = validateVisualCinematicContribution(raw.structured);
  if (!validation.valid) {
    const error = new Error("Visual + Cinematic Agent contribution failed Movie Mentor authority validation.");
    error.code = "VISUAL_CINEMATIC_CONTRIBUTION_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: {
      ...(raw.metadata || {}),
      visualCinematicAgentVersion: MOVIE_MENTOR_VISUAL_CINEMATIC_AGENT_VERSION,
      visualCinematicContractVersion: VISUAL_CINEMATIC_CONTRACT_VERSION,
      authority: { creatorTruthDominates: true, aiCannotCreateCanon: true, cameraSuggestionsAreOptional: true, mayAdvanceJourney: false, maySpeakDirectlyToCreator: false, mayOverwriteCreatorTruth: false, mentorMustSynthesize: true },
    },
  };
}

function getVisualCinematicAgentManifest() {
  return {
    id: VISUAL_CINEMATIC_AGENT_ID,
    name: "Movie Mentor Visual + Cinematic Agent",
    version: MOVIE_MENTOR_VISUAL_CINEMATIC_AGENT_VERSION,
    contractVersion: VISUAL_CINEMATIC_CONTRACT_VERSION,
    status: "standalone-not-wired",
    purpose: "Provide visual storytelling and cinematic intelligence while preserving creator authorship, canon and production intent.",
    authority: VISUAL_CINEMATIC_AUTHORITY,
    creatorFacing: false,
    vendorNeutral: true,
    providerExecution: "StructuredAIProviderClient",
    capabilities: ["visual-storytelling", "composition", "blocking", "camera-possibilities", "camera-movement", "point-of-view", "lighting", "atmosphere", "production-design", "visual-motifs", "visual-metaphor", "action-readability", "cinematic-transitions", "production-aware-alternatives"],
    restrictions: ["cannot-create-canon", "cannot-overwrite-creator-truth", "cannot-impose-shot-list", "cannot-assume-production-budget", "cannot-advance-journey", "cannot-speak-directly-to-creator", "cannot-silently-resolve-continuity-conflicts", "requires-mentor-synthesis"],
  };
}

export {
  MOVIE_MENTOR_VISUAL_CINEMATIC_AGENT_VERSION,
  VISUAL_CINEMATIC_CONTRACT_VERSION,
  VISUAL_CINEMATIC_AGENT_ID,
  VISUAL_CINEMATIC_AUTHORITY,
  VISUAL_CATEGORIES,
  VISUAL_OBSERVATION_SCHEMA,
  VISUAL_SUGGESTION_SCHEMA,
  VISUAL_CINEMATIC_AGENT_OUTPUT_SCHEMA,
  VISUAL_CINEMATIC_AGENT_INSTRUCTIONS,
  validateVisualCinematicWorkOrder,
  validateVisualCinematicContribution,
  createVisualCinematicWorkOrder,
  executeMovieMentorVisualCinematicAgent,
  getVisualCinematicAgentManifest,
};

export default executeMovieMentorVisualCinematicAgent;
