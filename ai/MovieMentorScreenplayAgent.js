/**
 * Movie Mentor Screenplay Agent
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
 * Translate creator-owned story and scene intention into screenplay-aware
 * craft guidance without taking authorship or inventing canon.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_SCREENPLAY_AGENT_VERSION = "1.0.0";
const SCREENPLAY_CONTRACT_VERSION = "1.0.0";
const SCREENPLAY_AGENT_ID = "screenplay";
const SCREENPLAY_AUTHORITY = "mentor-provisional";

const SCREENPLAY_CATEGORIES = Object.freeze([
  "scene-heading", "action", "character-cue", "dialogue", "parenthetical",
  "transition", "readability", "formatting", "visual-writing", "economy",
  "production-clarity", "scene-entry", "scene-exit", "other",
]);

function cleanString(value) { return typeof value === "string" ? value.trim() : ""; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function cloneValue(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }

const SCREENPLAY_OBSERVATION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: SCREENPLAY_CATEGORIES },
    observation: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "observation", "reason", "confidence"],
};

const SCREENPLAY_SUGGESTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: SCREENPLAY_CATEGORIES },
    suggestion: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    createsNewStoryFact: { type: "boolean" },
    requiresCreatorApproval: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "suggestion", "reason", "createsNewStoryFact", "requiresCreatorApproval", "confidence"],
};

const SCREENPLAY_AGENT_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [SCREENPLAY_AGENT_ID] },
    screenplayRead: { type: ["string", "null"] },
    observations: { type: "array", items: SCREENPLAY_OBSERVATION_SCHEMA },
    formattingObservations: { type: "array", items: SCREENPLAY_OBSERVATION_SCHEMA },
    visualWritingObservations: { type: "array", items: SCREENPLAY_OBSERVATION_SCHEMA },
    readabilityObservations: { type: "array", items: SCREENPLAY_OBSERVATION_SCHEMA },
    productionClarityObservations: { type: "array", items: SCREENPLAY_OBSERVATION_SCHEMA },
    provisionalSuggestions: { type: "array", items: SCREENPLAY_SUGGESTION_SCHEMA },
    continuityQuestions: { type: "array", items: SCREENPLAY_SUGGESTION_SCHEMA },
    draftFragment: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: {
      type: "object", additionalProperties: false,
      properties: { source: { type: "string" }, model: { type: ["string", "null"] }, contractVersion: { type: "string" } },
      required: ["source", "model", "contractVersion"],
    },
  },
  required: ["agentId", "screenplayRead", "observations", "formattingObservations", "visualWritingObservations", "readabilityObservations", "productionClarityObservations", "provisionalSuggestions", "continuityQuestions", "draftFragment", "confidence", "provenance"],
};

const SCREENPLAY_AGENT_INSTRUCTIONS = `
You are the internal Screenplay Agent for iBand Movie Mentor.
You NEVER speak directly to the creator. You provide screenplay-specialist intelligence only for later Mentor synthesis.

FOUNDING PRINCIPLE:
SCREENPLAY CRAFT SERVES THE CREATOR'S MOVIE. FORMATTING DOES NOT OWN THE STORY.

AUTHORITY RULES:
1. Creator-confirmed story, character, scene and dialogue intention outranks screenplay convention.
2. Existing protected canon must be respected.
3. AI inference and suggestion are not canon.
4. Never overwrite creator-confirmed truth or silently create story facts.
5. Never advance CreatorJourneyEngine.
6. Never claim screenplay convention is an absolute artistic law.
7. Distinguish formatting guidance from creative authorship.
8. Never rewrite a creator's voice merely to make it sound generic or industry-standard.
9. Do not add plot events, character history, relationships, dialogue facts, props or locations as established truth.
10. If a screenplay suggestion introduces a new story fact, set createsNewStoryFact=true and requiresCreatorApproval=true.
11. Never silently repair continuity conflicts. Flag them for Continuity Agent or Mentor synthesis.
12. Do not produce a screenplay draft unless draftingRequested=true.
13. If draftingRequested=false, draftFragment MUST be null.
14. If draftingRequested=true, any generated draft remains provisional and must preserve supplied creator intent and canon.
15. Respect creator-requested screenplay style or production context when supplied.
16. Prefer clear, filmable action writing over prose that describes inaccessible internal thoughts, unless the creator deliberately wants a nonstandard form.
17. Avoid excessive camera direction unless explicitly requested or essential to meaning.
18. Avoid unnecessary parentheticals and transitions when the intended performance or cut is already clear.

YOUR SPECIALTY:
- screenplay form and readability
- scene headings / sluglines
- action description
- character cues
- dialogue placement
- parenthetical restraint
- scene entry and exit
- visual, filmable writing
- action-line economy
- screenplay rhythm on the page
- production-facing clarity
- distinguishing prose/story notes from screenplay text
- identifying material that cannot be directly seen or heard
- screenplay formatting guidance without formulaic authorship

QUALITY PRINCIPLE:
A screenplay is a working cinematic document, not a novel with different margins. Clarity, intention and filmability matter more than decorative prose. But the creator's chosen style remains authoritative.

OUTPUT RULES:
All analysis is Mentor-provisional. Suggestions are possibilities, never decisions. Do not create canon. draftFragment is permitted only when explicitly requested in the work order. Return only the required structured output.
`.trim();

function validateScreenplayWorkOrder(workOrder = {}) {
  const issues = [];
  if (cleanString(workOrder.agentId) !== SCREENPLAY_AGENT_ID) issues.push("screenplay_agent_identity_required");
  if (workOrder.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (workOrder.mayAdvanceJourney !== false) issues.push("journey_advance_forbidden");
  if (workOrder.mayOverwriteCreatorTruth !== false) issues.push("creator_truth_overwrite_forbidden");
  if (workOrder.mayCreateCanon !== false) issues.push("canon_creation_forbidden");
  if (workOrder.authority !== SCREENPLAY_AUTHORITY) issues.push("screenplay_authority_must_be_mentor_provisional");
  return { valid: issues.length === 0, issues };
}

function validateScreenplayContribution(candidate = {}, { draftingRequested = false } = {}) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") return { valid: false, issues: ["missing_screenplay_contribution"], contribution: null };
  if (cleanString(candidate.agentId) !== SCREENPLAY_AGENT_ID) issues.push("screenplay_agent_identity_mismatch");
  if (draftingRequested !== true && cleanString(candidate.draftFragment)) issues.push("draft_fragment_not_requested");

  const suggestions = [...asArray(candidate.provisionalSuggestions), ...asArray(candidate.continuityQuestions)];
  for (const item of suggestions) {
    if (item?.createsNewStoryFact === true && item?.requiresCreatorApproval !== true) issues.push("new_story_fact_requires_creator_approval");
  }

  const contribution = {
    agentId: SCREENPLAY_AGENT_ID,
    screenplayRead: candidate.screenplayRead || null,
    observations: asArray(candidate.observations),
    formattingObservations: asArray(candidate.formattingObservations),
    visualWritingObservations: asArray(candidate.visualWritingObservations),
    readabilityObservations: asArray(candidate.readabilityObservations),
    productionClarityObservations: asArray(candidate.productionClarityObservations),
    provisionalSuggestions: asArray(candidate.provisionalSuggestions),
    continuityQuestions: asArray(candidate.continuityQuestions),
    draftFragment: draftingRequested === true ? (candidate.draftFragment || null) : null,
    confidence: Number(candidate.confidence || 0),
    provenance: { ...(candidate.provenance || {}), source: "movie-mentor-screenplay-agent", contractVersion: SCREENPLAY_CONTRACT_VERSION },
    authority: SCREENPLAY_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };

  return { valid: issues.length === 0, issues, contribution };
}

function createScreenplayWorkOrder({ stageId = null, taskId = null, sceneId = null, creatorMessage = null, semanticIntelligence = {}, creatorConfirmedContext = [], protectedCanon = [], storyContext = null, characterContext = [], sceneContext = null, dialogueContext = null, continuityContext = null, visualContext = null, screenplayText = null, creatorScreenplayStyle = null, productionContext = {}, draftingRequested = false, projectJourney = null, metadata = {} } = {}) {
  return {
    agentId: SCREENPLAY_AGENT_ID,
    purpose: "Provide screenplay-craft intelligence and, only when explicitly requested, provisional screenplay drafting while preserving creator authorship and canon.",
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
      dialogueContext: cloneValue(dialogueContext),
      continuityContext: cloneValue(continuityContext),
      visualContext: cloneValue(visualContext),
      screenplayText: cleanString(screenplayText) || null,
      creatorScreenplayStyle: cloneValue(creatorScreenplayStyle),
      productionContext: productionContext && typeof productionContext === "object" ? cloneValue(productionContext) : {},
      draftingRequested: draftingRequested === true,
      projectJourney: cloneValue(projectJourney),
      metadata: metadata && typeof metadata === "object" ? cloneValue(metadata) : {},
    },
    authority: SCREENPLAY_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
}

async function executeMovieMentorScreenplayAgent(workOrder = {}) {
  const preflight = validateScreenplayWorkOrder(workOrder);
  if (!preflight.valid) {
    const error = new Error("Screenplay Agent work order failed Movie Mentor authority preflight.");
    error.code = "SCREENPLAY_WORK_ORDER_INVALID";
    error.validationIssues = preflight.issues;
    throw error;
  }

  const draftingRequested = workOrder?.input?.draftingRequested === true;

  const raw = await executeStructuredAI({
    task: "movie-mentor-specialist:screenplay",
    systemInstructions: SCREENPLAY_AGENT_INSTRUCTIONS,
    input: {
      agentId: SCREENPLAY_AGENT_ID,
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
      dialogueContext: cloneValue(workOrder?.input?.dialogueContext || null),
      continuityContext: cloneValue(workOrder?.input?.continuityContext || null),
      visualContext: cloneValue(workOrder?.input?.visualContext || null),
      screenplayText: workOrder?.input?.screenplayText || null,
      creatorScreenplayStyle: cloneValue(workOrder?.input?.creatorScreenplayStyle || null),
      productionContext: cloneValue(workOrder?.input?.productionContext || {}),
      draftingRequested,
      projectJourney: cloneValue(workOrder?.input?.projectJourney || null),
      instruction: draftingRequested
        ? "Provide screenplay intelligence and a provisional draft fragment only within supplied creator intent and canon."
        : "Provide screenplay intelligence only. draftFragment must be null because drafting was not requested.",
    },
    schema: SCREENPLAY_AGENT_OUTPUT_SCHEMA,
    schemaName: "movie_mentor_screenplay_contribution",
    metadata: {
      screenplayAgentVersion: MOVIE_MENTOR_SCREENPLAY_AGENT_VERSION,
      screenplayContractVersion: SCREENPLAY_CONTRACT_VERSION,
      creatorTruthDominates: true,
      aiCannotCreateCanon: true,
      draftingRequested,
    },
  });

  if (!raw?.structured) {
    const error = new Error("Screenplay Agent provider did not return structured intelligence.");
    error.code = "SCREENPLAY_STRUCTURED_OUTPUT_INVALID";
    throw error;
  }

  raw.structured.provenance = { source: "movie-mentor-screenplay-agent", model: raw?.metadata?.model || null, contractVersion: SCREENPLAY_CONTRACT_VERSION };
  const validation = validateScreenplayContribution(raw.structured, { draftingRequested });
  if (!validation.valid) {
    const error = new Error("Screenplay Agent contribution failed Movie Mentor authority validation.");
    error.code = "SCREENPLAY_CONTRIBUTION_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: {
      ...(raw.metadata || {}),
      screenplayAgentVersion: MOVIE_MENTOR_SCREENPLAY_AGENT_VERSION,
      screenplayContractVersion: SCREENPLAY_CONTRACT_VERSION,
      draftingRequested,
      authority: { creatorTruthDominates: true, aiCannotCreateCanon: true, mayAdvanceJourney: false, maySpeakDirectlyToCreator: false, mayOverwriteCreatorTruth: false, mentorMustSynthesize: true },
    },
  };
}

function getScreenplayAgentManifest() {
  return {
    id: SCREENPLAY_AGENT_ID,
    name: "Movie Mentor Screenplay Agent",
    version: MOVIE_MENTOR_SCREENPLAY_AGENT_VERSION,
    contractVersion: SCREENPLAY_CONTRACT_VERSION,
    status: "standalone-not-wired",
    purpose: "Provide screenplay craft, formatting and optional provisional drafting intelligence while preserving creator authorship and canon.",
    authority: SCREENPLAY_AUTHORITY,
    creatorFacing: false,
    vendorNeutral: true,
    providerExecution: "StructuredAIProviderClient",
    capabilities: ["screenplay-form", "scene-headings", "action-description", "character-cues", "dialogue-placement", "parenthetical-restraint", "visual-writing", "readability", "production-clarity", "scene-entry-and-exit", "optional-provisional-drafting"],
    restrictions: ["cannot-create-canon", "cannot-overwrite-creator-truth", "cannot-draft-unless-requested", "cannot-impose-format-as-artistic-law", "cannot-advance-journey", "cannot-speak-directly-to-creator", "cannot-silently-resolve-continuity-conflicts", "requires-mentor-synthesis"],
  };
}

export {
  MOVIE_MENTOR_SCREENPLAY_AGENT_VERSION,
  SCREENPLAY_CONTRACT_VERSION,
  SCREENPLAY_AGENT_ID,
  SCREENPLAY_AUTHORITY,
  SCREENPLAY_CATEGORIES,
  SCREENPLAY_OBSERVATION_SCHEMA,
  SCREENPLAY_SUGGESTION_SCHEMA,
  SCREENPLAY_AGENT_OUTPUT_SCHEMA,
  SCREENPLAY_AGENT_INSTRUCTIONS,
  validateScreenplayWorkOrder,
  validateScreenplayContribution,
  createScreenplayWorkOrder,
  executeMovieMentorScreenplayAgent,
  getScreenplayAgentManifest,
};

export default executeMovieMentorScreenplayAgent;
