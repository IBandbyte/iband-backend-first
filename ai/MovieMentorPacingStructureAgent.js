/**
 * Movie Mentor Pacing + Structure Agent
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
 * Analyse narrative rhythm and structural movement without forcing the
 * creator's movie into a formula or taking authorship away from them.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_PACING_STRUCTURE_AGENT_VERSION = "1.0.0";
const PACING_STRUCTURE_CONTRACT_VERSION = "1.0.0";
const PACING_STRUCTURE_AGENT_ID = "pacing-structure";
const PACING_STRUCTURE_AUTHORITY = "mentor-provisional";

const STRUCTURAL_CATEGORIES = Object.freeze([
  "setup", "progression", "escalation", "reversal", "reveal", "turning-point",
  "repetition", "setup-payoff", "character-arc", "story-thread", "scene-order",
  "transition", "climax", "resolution", "other",
]);

const PACING_CATEGORIES = Object.freeze([
  "too-fast", "too-slow", "balanced", "deliberate-pause", "compression",
  "expansion", "repetition", "tension", "release", "rhythm", "other",
]);

function cleanString(value) { return typeof value === "string" ? value.trim() : ""; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function cloneValue(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }

const STRUCTURAL_OBSERVATION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: STRUCTURAL_CATEGORIES },
    sceneId: { type: ["string", "null"] },
    observation: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "sceneId", "observation", "reason", "confidence"],
};

const PACING_OBSERVATION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: PACING_CATEGORIES },
    sceneId: { type: ["string", "null"] },
    observation: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "sceneId", "observation", "reason", "confidence"],
};

const PACING_STRUCTURE_SUGGESTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    category: { type: "string", enum: ["structure", "pacing", "scene-order", "setup-payoff", "escalation", "compression", "expansion", "other"] },
    suggestion: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    createsNewStoryFact: { type: "boolean" },
    requiresCreatorApproval: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "suggestion", "reason", "createsNewStoryFact", "requiresCreatorApproval", "confidence"],
};

const PACING_STRUCTURE_AGENT_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [PACING_STRUCTURE_AGENT_ID] },
    overallStructuralRead: { type: ["string", "null"] },
    overallPacingRead: { type: ["string", "null"] },
    structuralObservations: { type: "array", items: STRUCTURAL_OBSERVATION_SCHEMA },
    pacingObservations: { type: "array", items: PACING_OBSERVATION_SCHEMA },
    repetitionRisks: { type: "array", items: STRUCTURAL_OBSERVATION_SCHEMA },
    setupPayoffObservations: { type: "array", items: STRUCTURAL_OBSERVATION_SCHEMA },
    escalationObservations: { type: "array", items: STRUCTURAL_OBSERVATION_SCHEMA },
    provisionalSuggestions: { type: "array", items: PACING_STRUCTURE_SUGGESTION_SCHEMA },
    continuityQuestions: { type: "array", items: PACING_STRUCTURE_SUGGESTION_SCHEMA },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: {
      type: "object", additionalProperties: false,
      properties: { source: { type: "string" }, model: { type: ["string", "null"] }, contractVersion: { type: "string" } },
      required: ["source", "model", "contractVersion"],
    },
  },
  required: ["agentId", "overallStructuralRead", "overallPacingRead", "structuralObservations", "pacingObservations", "repetitionRisks", "setupPayoffObservations", "escalationObservations", "provisionalSuggestions", "continuityQuestions", "confidence", "provenance"],
};

const PACING_STRUCTURE_AGENT_INSTRUCTIONS = `
You are the internal Pacing + Structure Agent for iBand Movie Mentor.
You NEVER speak directly to the creator. You provide specialist intelligence only for later Mentor synthesis.

FOUNDING PRINCIPLE:
STRUCTURE SERVES THE CREATOR'S MOVIE. THE CREATOR'S MOVIE DOES NOT SERVE A FORMULA.

AUTHORITY RULES:
1. Creator-confirmed intention outranks structural convention.
2. Existing protected canon must be respected.
3. AI inference and suggestion are not canon.
4. Never overwrite creator-confirmed truth or silently create new story facts.
5. Never advance CreatorJourneyEngine.
6. Never claim a conventional screenplay structure is mandatory.
7. Never force three-act, five-act, beat-sheet, hero's-journey or other templates unless the creator asks for one.
8. A slow scene is not automatically a pacing problem. Deliberate stillness, atmosphere and reflection can be artistically correct.
9. A fast sequence is not automatically rushed. Compression can be intentional.
10. Judge pacing relative to creator intention, genre, tone, surrounding material and dramatic purpose.
11. Identify repetition when scenes or beats perform substantially the same dramatic job without meaningful development.
12. Identify setup/payoff relationships without inventing missing payoffs as fact.
13. If a proposed structural improvement creates a new story fact, label it provisional and require creator approval.
14. Never repair continuity by invention. Flag continuity questions for later Continuity Agent or Mentor handling.
15. Preserve unconventional storytelling when it appears intentional.

YOUR SPECIALTY:
- whole-story structural movement
- sequence and scene order
- narrative rhythm
- escalation and release
- repetition
- setup and payoff
- turning points and reversals
- story-thread distribution
- character-arc pacing
- compression and expansion
- scene density
- transitions
- climax preparation
- resolution pacing
- identifying sections that may stall without assuming every quiet section is wrong

OUTPUT RULES:
All analysis is Mentor-provisional. Suggestions are options, never decisions. Do not create canon. Do not prescribe formula for its own sake. Return only the required structured output.
`.trim();

function validatePacingStructureWorkOrder(workOrder = {}) {
  const issues = [];
  if (cleanString(workOrder.agentId) !== PACING_STRUCTURE_AGENT_ID) issues.push("pacing_structure_agent_identity_required");
  if (workOrder.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (workOrder.mayAdvanceJourney !== false) issues.push("journey_advance_forbidden");
  if (workOrder.mayOverwriteCreatorTruth !== false) issues.push("creator_truth_overwrite_forbidden");
  if (workOrder.mayCreateCanon !== false) issues.push("canon_creation_forbidden");
  if (workOrder.authority !== PACING_STRUCTURE_AUTHORITY) issues.push("pacing_structure_authority_must_be_mentor_provisional");
  return { valid: issues.length === 0, issues };
}

function validatePacingStructureContribution(candidate = {}) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") return { valid: false, issues: ["missing_pacing_structure_contribution"], contribution: null };
  if (cleanString(candidate.agentId) !== PACING_STRUCTURE_AGENT_ID) issues.push("pacing_structure_agent_identity_mismatch");
  const suggestions = [...asArray(candidate.provisionalSuggestions), ...asArray(candidate.continuityQuestions)];
  for (const item of suggestions) {
    if (item?.createsNewStoryFact === true && item?.requiresCreatorApproval !== true) issues.push("new_story_fact_requires_creator_approval");
  }
  const contribution = {
    agentId: PACING_STRUCTURE_AGENT_ID,
    overallStructuralRead: candidate.overallStructuralRead || null,
    overallPacingRead: candidate.overallPacingRead || null,
    structuralObservations: asArray(candidate.structuralObservations),
    pacingObservations: asArray(candidate.pacingObservations),
    repetitionRisks: asArray(candidate.repetitionRisks),
    setupPayoffObservations: asArray(candidate.setupPayoffObservations),
    escalationObservations: asArray(candidate.escalationObservations),
    provisionalSuggestions: asArray(candidate.provisionalSuggestions),
    continuityQuestions: asArray(candidate.continuityQuestions),
    confidence: Number(candidate.confidence || 0),
    provenance: { ...(candidate.provenance || {}), source: "movie-mentor-pacing-structure-agent", contractVersion: PACING_STRUCTURE_CONTRACT_VERSION },
    authority: PACING_STRUCTURE_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
  return { valid: issues.length === 0, issues, contribution };
}

function createPacingStructureWorkOrder({ stageId = null, taskId = null, creatorMessage = null, semanticIntelligence = {}, creatorConfirmedContext = [], protectedCanon = [], storyContext = null, characterContext = [], sceneSequence = [], continuityContext = null, creatorStructuralIntent = null, projectJourney = null, metadata = {} } = {}) {
  return {
    agentId: PACING_STRUCTURE_AGENT_ID,
    purpose: "Analyse narrative pacing and structural movement without imposing formula or taking authorship away from the creator.",
    input: {
      stageId: cleanString(stageId) || null,
      taskId: cleanString(taskId) || null,
      creatorMessage: cleanString(creatorMessage) || null,
      semanticIntelligence: cloneValue(semanticIntelligence),
      creatorConfirmedContext: cloneValue(asArray(creatorConfirmedContext)),
      protectedCanon: cloneValue(asArray(protectedCanon)),
      storyContext: cloneValue(storyContext),
      characterContext: cloneValue(asArray(characterContext)),
      sceneSequence: cloneValue(asArray(sceneSequence)),
      continuityContext: cloneValue(continuityContext),
      creatorStructuralIntent: cloneValue(creatorStructuralIntent),
      projectJourney: cloneValue(projectJourney),
      metadata: metadata && typeof metadata === "object" ? cloneValue(metadata) : {},
    },
    authority: PACING_STRUCTURE_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
}

async function executeMovieMentorPacingStructureAgent(workOrder = {}) {
  const preflight = validatePacingStructureWorkOrder(workOrder);
  if (!preflight.valid) {
    const error = new Error("Pacing + Structure Agent work order failed Movie Mentor authority preflight.");
    error.code = "PACING_STRUCTURE_WORK_ORDER_INVALID";
    error.validationIssues = preflight.issues;
    throw error;
  }

  const raw = await executeStructuredAI({
    task: "movie-mentor-specialist:pacing-structure",
    systemInstructions: PACING_STRUCTURE_AGENT_INSTRUCTIONS,
    input: {
      agentId: PACING_STRUCTURE_AGENT_ID,
      purpose: workOrder?.purpose || null,
      stageId: workOrder?.input?.stageId || null,
      taskId: workOrder?.input?.taskId || null,
      creatorMessage: workOrder?.input?.creatorMessage || null,
      semanticIntelligence: cloneValue(workOrder?.input?.semanticIntelligence || {}),
      creatorConfirmedContext: cloneValue(workOrder?.input?.creatorConfirmedContext || []),
      protectedCanon: cloneValue(workOrder?.input?.protectedCanon || []),
      storyContext: cloneValue(workOrder?.input?.storyContext || null),
      characterContext: cloneValue(workOrder?.input?.characterContext || []),
      sceneSequence: cloneValue(workOrder?.input?.sceneSequence || []),
      continuityContext: cloneValue(workOrder?.input?.continuityContext || null),
      creatorStructuralIntent: cloneValue(workOrder?.input?.creatorStructuralIntent || null),
      projectJourney: cloneValue(workOrder?.input?.projectJourney || null),
      instruction: "Analyse pacing and structure only. Preserve creator authority and never impose a formula as a rule.",
    },
    schema: PACING_STRUCTURE_AGENT_OUTPUT_SCHEMA,
    schemaName: "movie_mentor_pacing_structure_contribution",
    metadata: {
      pacingStructureAgentVersion: MOVIE_MENTOR_PACING_STRUCTURE_AGENT_VERSION,
      pacingStructureContractVersion: PACING_STRUCTURE_CONTRACT_VERSION,
      creatorTruthDominates: true,
      formulaIsOptional: true,
      aiCannotCreateCanon: true,
    },
  });

  if (!raw?.structured) {
    const error = new Error("Pacing + Structure Agent provider did not return structured intelligence.");
    error.code = "PACING_STRUCTURE_STRUCTURED_OUTPUT_INVALID";
    throw error;
  }

  raw.structured.provenance = { source: "movie-mentor-pacing-structure-agent", model: raw?.metadata?.model || null, contractVersion: PACING_STRUCTURE_CONTRACT_VERSION };
  const validation = validatePacingStructureContribution(raw.structured);
  if (!validation.valid) {
    const error = new Error("Pacing + Structure Agent contribution failed Movie Mentor authority validation.");
    error.code = "PACING_STRUCTURE_CONTRIBUTION_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: {
      ...(raw.metadata || {}),
      pacingStructureAgentVersion: MOVIE_MENTOR_PACING_STRUCTURE_AGENT_VERSION,
      pacingStructureContractVersion: PACING_STRUCTURE_CONTRACT_VERSION,
      authority: { creatorTruthDominates: true, formulaIsOptional: true, aiCannotCreateCanon: true, mayAdvanceJourney: false, maySpeakDirectlyToCreator: false, mayOverwriteCreatorTruth: false, mentorMustSynthesize: true },
    },
  };
}

function getPacingStructureAgentManifest() {
  return {
    id: PACING_STRUCTURE_AGENT_ID,
    name: "Movie Mentor Pacing + Structure Agent",
    version: MOVIE_MENTOR_PACING_STRUCTURE_AGENT_VERSION,
    contractVersion: PACING_STRUCTURE_CONTRACT_VERSION,
    status: "standalone-not-wired",
    purpose: "Analyse narrative pacing and structural movement while preserving creator intent and avoiding formulaic authorship.",
    authority: PACING_STRUCTURE_AUTHORITY,
    creatorFacing: false,
    vendorNeutral: true,
    providerExecution: "StructuredAIProviderClient",
    capabilities: ["structural-movement", "narrative-rhythm", "scene-sequence", "escalation", "repetition-detection", "setup-payoff", "turning-points", "story-thread-distribution", "compression", "expansion", "climax-preparation", "resolution-pacing"],
    restrictions: ["cannot-create-canon", "cannot-overwrite-creator-truth", "cannot-impose-formula", "cannot-advance-journey", "cannot-speak-directly-to-creator", "cannot-silently-resolve-continuity-conflicts", "requires-mentor-synthesis"],
  };
}

export {
  MOVIE_MENTOR_PACING_STRUCTURE_AGENT_VERSION,
  PACING_STRUCTURE_CONTRACT_VERSION,
  PACING_STRUCTURE_AGENT_ID,
  PACING_STRUCTURE_AUTHORITY,
  STRUCTURAL_CATEGORIES,
  PACING_CATEGORIES,
  STRUCTURAL_OBSERVATION_SCHEMA,
  PACING_OBSERVATION_SCHEMA,
  PACING_STRUCTURE_SUGGESTION_SCHEMA,
  PACING_STRUCTURE_AGENT_OUTPUT_SCHEMA,
  PACING_STRUCTURE_AGENT_INSTRUCTIONS,
  validatePacingStructureWorkOrder,
  validatePacingStructureContribution,
  createPacingStructureWorkOrder,
  executeMovieMentorPacingStructureAgent,
  getPacingStructureAgentManifest,
};

export default executeMovieMentorPacingStructureAgent;
