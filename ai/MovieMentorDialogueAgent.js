/**
 * Movie Mentor Dialogue Agent
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
 * Help Movie Mentor understand and improve dialogue, character voice,
 * subtext and conversational dynamics without taking authorship away
 * from the creator or inventing canon.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_DIALOGUE_AGENT_VERSION = "1.0.0";
const DIALOGUE_CONTRACT_VERSION = "1.0.0";
const DIALOGUE_AGENT_ID = "dialogue";
const DIALOGUE_AUTHORITY = "mentor-provisional";

const DIALOGUE_CATEGORIES = Object.freeze([
  "character-voice",
  "subtext",
  "exposition",
  "conflict",
  "emotion",
  "rhythm",
  "silence",
  "interruption",
  "information-flow",
  "relationship-dynamic",
  "scene-purpose",
  "naturalism",
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

const CHARACTER_VOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    characterId: { type: ["string", "null"] },
    observedVoice: { type: ["string", "null"] },
    establishedVoiceAlignment: { type: "string", enum: ["aligned", "uncertain", "possible-drift", "not-enough-context"] },
    reason: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["characterId", "observedVoice", "establishedVoiceAlignment", "reason", "confidence"],
};

const DIALOGUE_OBSERVATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: DIALOGUE_CATEGORIES },
    observation: { type: ["string", "null"] },
    characterId: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "observation", "characterId", "reason", "confidence"],
};

const DIALOGUE_SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: DIALOGUE_CATEGORIES },
    suggestion: { type: ["string", "null"] },
    characterId: { type: ["string", "null"] },
    reason: { type: ["string", "null"] },
    createsNewStoryFact: { type: "boolean" },
    requiresCreatorApproval: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["category", "suggestion", "characterId", "reason", "createsNewStoryFact", "requiresCreatorApproval", "confidence"],
};

const DIALOGUE_AGENT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [DIALOGUE_AGENT_ID] },
    dialoguePurpose: { type: ["string", "null"] },
    characterVoices: { type: "array", items: CHARACTER_VOICE_SCHEMA },
    observations: { type: "array", items: DIALOGUE_OBSERVATION_SCHEMA },
    subtextOpportunities: { type: "array", items: DIALOGUE_SUGGESTION_SCHEMA },
    expositionRisks: { type: "array", items: DIALOGUE_OBSERVATION_SCHEMA },
    rhythmOpportunities: { type: "array", items: DIALOGUE_SUGGESTION_SCHEMA },
    silenceAndInterruptionOpportunities: { type: "array", items: DIALOGUE_SUGGESTION_SCHEMA },
    provisionalSuggestions: { type: "array", items: DIALOGUE_SUGGESTION_SCHEMA },
    continuityQuestions: { type: "array", items: DIALOGUE_SUGGESTION_SCHEMA },
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
  required: ["agentId", "dialoguePurpose", "characterVoices", "observations", "subtextOpportunities", "expositionRisks", "rhythmOpportunities", "silenceAndInterruptionOpportunities", "provisionalSuggestions", "continuityQuestions", "confidence", "provenance"],
};

const DIALOGUE_AGENT_INSTRUCTIONS = `
You are the internal Dialogue Agent for iBand Movie Mentor.

You NEVER speak directly to the creator.
You provide dialogue-specialist intelligence only for later Mentor synthesis.

FOUNDING PRINCIPLE:
THE CREATOR OWNS THE CHARACTERS AND THEIR VOICES.
YOU HELP THE CREATOR HEAR THEM MORE CLEARLY; YOU DO NOT TAKE AUTHORSHIP.

AUTHORITY RULES:
1. Creator-confirmed character information and dialogue intentions outrank every AI inference or suggestion.
2. Existing protected canon must be respected.
3. AI inference is not canon.
4. AI suggestion is not canon.
5. Never silently invent character history, relationships, secrets, motives or knowledge as established fact.
6. Never overwrite creator-confirmed truth.
7. Never advance CreatorJourneyEngine.
8. Never claim the creator decided something they did not decide.
9. Never silently repair a continuity conflict by inventing an explanation.
10. If dialogue appears to conflict with established character knowledge, relationships or canon, flag a continuity question for Mentor synthesis.
11. Any suggestion introducing a new story fact must set createsNewStoryFact=true and requiresCreatorApproval=true.
12. Preserve the creator's language, tone, humour, cultural context and intended character identity wherever possible.
13. Do not make every character witty, eloquent or emotionally articulate.
14. Characters may misunderstand, hesitate, interrupt, evade, lie, remain silent or speak imperfectly when appropriate to creator intent.
15. Avoid exposition merely because information exists. People should not unnaturally tell each other facts they already know unless the creator has a reason.
16. Distinguish character voice from generic polished AI prose.
17. Do not flatten dialect, speech pattern or personality into one universal voice.
18. Never stereotype a character from demographic information.

YOUR SPECIALTY:
- distinct character voice
- dialogue purpose
- subtext
- conflict through conversation
- emotional truth
- exposition detection
- information flow
- conversational rhythm
- interruptions and overlaps
- silence and hesitation
- relationship dynamics
- what a character knows or does not know
- natural versus deliberately stylised dialogue
- identifying when multiple characters sound too similar
- identifying when dialogue says explicitly what the scene could imply

QUALITY PRINCIPLE:
Good dialogue is not simply realistic transcription. It serves the creator's scene and characters. Sometimes the most important line is the one a character avoids saying.

OUTPUT RULES:
- All analysis is Mentor-provisional.
- Suggestions are possibilities, never decisions.
- Do not convert suggestions into canon.
- Do not rewrite the creator's entire scene unless the work order explicitly requests drafting support.
- Do not invent facts to make dialogue work.
- continuityQuestions identify risks for later Continuity Agent or Mentor handling; do not resolve them by invention.
- Return only the required structured output.
`.trim();

function validateDialogueWorkOrder(workOrder = {}) {
  const issues = [];
  if (cleanString(workOrder.agentId) !== DIALOGUE_AGENT_ID) issues.push("dialogue_agent_identity_required");
  if (workOrder.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (workOrder.mayAdvanceJourney !== false) issues.push("journey_advance_forbidden");
  if (workOrder.mayOverwriteCreatorTruth !== false) issues.push("creator_truth_overwrite_forbidden");
  if (workOrder.mayCreateCanon !== false) issues.push("canon_creation_forbidden");
  if (workOrder.authority !== DIALOGUE_AUTHORITY) issues.push("dialogue_authority_must_be_mentor_provisional");
  return { valid: issues.length === 0, issues };
}

function validateDialogueContribution(candidate = {}) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") {
    return { valid: false, issues: ["missing_dialogue_contribution"], contribution: null };
  }
  if (cleanString(candidate.agentId) !== DIALOGUE_AGENT_ID) issues.push("dialogue_agent_identity_mismatch");

  const suggestions = [
    ...asArray(candidate.subtextOpportunities),
    ...asArray(candidate.rhythmOpportunities),
    ...asArray(candidate.silenceAndInterruptionOpportunities),
    ...asArray(candidate.provisionalSuggestions),
    ...asArray(candidate.continuityQuestions),
  ];

  for (const item of suggestions) {
    if (item?.createsNewStoryFact === true && item?.requiresCreatorApproval !== true) {
      issues.push("new_story_fact_requires_creator_approval");
    }
  }

  const contribution = {
    agentId: DIALOGUE_AGENT_ID,
    dialoguePurpose: candidate.dialoguePurpose || null,
    characterVoices: asArray(candidate.characterVoices),
    observations: asArray(candidate.observations),
    subtextOpportunities: asArray(candidate.subtextOpportunities),
    expositionRisks: asArray(candidate.expositionRisks),
    rhythmOpportunities: asArray(candidate.rhythmOpportunities),
    silenceAndInterruptionOpportunities: asArray(candidate.silenceAndInterruptionOpportunities),
    provisionalSuggestions: asArray(candidate.provisionalSuggestions),
    continuityQuestions: asArray(candidate.continuityQuestions),
    confidence: Number(candidate.confidence || 0),
    provenance: {
      ...(candidate.provenance || {}),
      source: "movie-mentor-dialogue-agent",
      contractVersion: DIALOGUE_CONTRACT_VERSION,
    },
    authority: DIALOGUE_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };

  return { valid: issues.length === 0, issues, contribution };
}

function createDialogueWorkOrder({
  stageId = null,
  taskId = null,
  sceneId = null,
  creatorMessage = null,
  semanticIntelligence = {},
  creatorConfirmedContext = [],
  protectedCanon = [],
  storyContext = null,
  characterContext = [],
  sceneContext = null,
  continuityContext = null,
  dialogueText = null,
  draftingRequested = false,
  projectJourney = null,
  metadata = {},
} = {}) {
  return {
    agentId: DIALOGUE_AGENT_ID,
    purpose: "Analyse dialogue, character voice, subtext and conversational dynamics while preserving creator authorship and established canon.",
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
      dialogueText: cleanString(dialogueText) || null,
      draftingRequested: draftingRequested === true,
      projectJourney: cloneValue(projectJourney),
      metadata: metadata && typeof metadata === "object" ? cloneValue(metadata) : {},
    },
    authority: DIALOGUE_AUTHORITY,
    creatorFacing: false,
    mayAdvanceJourney: false,
    mayOverwriteCreatorTruth: false,
    mayCreateCanon: false,
    requiresMentorSynthesis: true,
  };
}

async function executeMovieMentorDialogueAgent(workOrder = {}) {
  const preflight = validateDialogueWorkOrder(workOrder);
  if (!preflight.valid) {
    const error = new Error("Dialogue Agent work order failed Movie Mentor authority preflight.");
    error.code = "DIALOGUE_WORK_ORDER_INVALID";
    error.validationIssues = preflight.issues;
    throw error;
  }

  const raw = await executeStructuredAI({
    task: "movie-mentor-specialist:dialogue",
    systemInstructions: DIALOGUE_AGENT_INSTRUCTIONS,
    input: {
      agentId: DIALOGUE_AGENT_ID,
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
      dialogueText: workOrder?.input?.dialogueText || null,
      draftingRequested: workOrder?.input?.draftingRequested === true,
      projectJourney: cloneValue(workOrder?.input?.projectJourney || null),
      instruction: "Provide dialogue intelligence only. Preserve creator authority and label every new story possibility as provisional.",
    },
    schema: DIALOGUE_AGENT_OUTPUT_SCHEMA,
    schemaName: "movie_mentor_dialogue_contribution",
    metadata: {
      dialogueAgentVersion: MOVIE_MENTOR_DIALOGUE_AGENT_VERSION,
      dialogueContractVersion: DIALOGUE_CONTRACT_VERSION,
      creatorTruthDominates: true,
      aiCannotCreateCanon: true,
    },
  });

  if (!raw?.structured) {
    const error = new Error("Dialogue Agent provider did not return structured intelligence.");
    error.code = "DIALOGUE_STRUCTURED_OUTPUT_INVALID";
    throw error;
  }

  raw.structured.provenance = {
    source: "movie-mentor-dialogue-agent",
    model: raw?.metadata?.model || null,
    contractVersion: DIALOGUE_CONTRACT_VERSION,
  };

  const validation = validateDialogueContribution(raw.structured);
  if (!validation.valid) {
    const error = new Error("Dialogue Agent contribution failed Movie Mentor authority validation.");
    error.code = "DIALOGUE_CONTRIBUTION_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: {
      ...(raw.metadata || {}),
      dialogueAgentVersion: MOVIE_MENTOR_DIALOGUE_AGENT_VERSION,
      dialogueContractVersion: DIALOGUE_CONTRACT_VERSION,
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

function getDialogueAgentManifest() {
  return {
    id: DIALOGUE_AGENT_ID,
    name: "Movie Mentor Dialogue Agent",
    version: MOVIE_MENTOR_DIALOGUE_AGENT_VERSION,
    contractVersion: DIALOGUE_CONTRACT_VERSION,
    status: "standalone-not-wired",
    purpose: "Provide character-voice, dialogue, subtext and conversational intelligence while preserving creator authorship and canon.",
    authority: DIALOGUE_AUTHORITY,
    creatorFacing: false,
    vendorNeutral: true,
    providerExecution: "StructuredAIProviderClient",
    capabilities: [
      "character-voice",
      "dialogue-purpose",
      "subtext",
      "exposition-detection",
      "conflict-through-dialogue",
      "emotional-dialogue",
      "conversation-rhythm",
      "silence-and-hesitation",
      "interruptions",
      "information-flow",
      "relationship-dynamics",
      "voice-differentiation",
      "continuity-risk-identification",
    ],
    restrictions: [
      "cannot-create-canon",
      "cannot-overwrite-creator-truth",
      "cannot-invent-character-history-as-fact",
      "cannot-promote-ai-suggestion-to-canon",
      "cannot-advance-journey",
      "cannot-speak-directly-to-creator",
      "cannot-silently-resolve-continuity-conflicts",
      "requires-mentor-synthesis",
    ],
  };
}

export {
  MOVIE_MENTOR_DIALOGUE_AGENT_VERSION,
  DIALOGUE_CONTRACT_VERSION,
  DIALOGUE_AGENT_ID,
  DIALOGUE_AUTHORITY,
  DIALOGUE_CATEGORIES,
  CHARACTER_VOICE_SCHEMA,
  DIALOGUE_OBSERVATION_SCHEMA,
  DIALOGUE_SUGGESTION_SCHEMA,
  DIALOGUE_AGENT_OUTPUT_SCHEMA,
  DIALOGUE_AGENT_INSTRUCTIONS,
  validateDialogueWorkOrder,
  validateDialogueContribution,
  createDialogueWorkOrder,
  executeMovieMentorDialogueAgent,
  getDialogueAgentManifest,
};

export default executeMovieMentorDialogueAgent;
