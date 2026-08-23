/**
 * Movie Mentor Continuity Agent
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
 * Protect established movie reality across scenes without inventing,
 * promoting, rewriting or silently resolving creator truth.
 *
 * Founding rule:
 * THE AI CANNOT CREATE CANON.
 * THE CREATOR CREATES CANON.
 */

import { executeStructuredAI } from "./StructuredAIProviderClient.js";

const MOVIE_MENTOR_CONTINUITY_AGENT_VERSION = "1.0.0";
const CONTINUITY_CONTRACT_VERSION = "1.0.0";
const CONTINUITY_AGENT_ID = "continuity";

const CONTINUITY_AUTHORITY = Object.freeze({
  CREATOR_CONFIRMED: "creator-confirmed",
  CREATOR_APPROVED_AI: "creator-approved-ai",
  AI_INFERRED: "ai-inferred",
  AI_SUGGESTED: "ai-suggested",
  MENTOR_PROVISIONAL: "mentor-provisional",
});

const PROTECTED_CANON_AUTHORITIES = new Set([
  CONTINUITY_AUTHORITY.CREATOR_CONFIRMED,
  CONTINUITY_AUTHORITY.CREATOR_APPROVED_AI,
]);

const CONTINUITY_CATEGORIES = Object.freeze([
  "character", "relationship", "knowledge", "location", "timeline", "event",
  "injury", "appearance", "costume", "prop", "object-state", "environment",
  "story-thread", "cause-effect", "other",
]);

function cleanString(value) { return typeof value === "string" ? value.trim() : ""; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function cloneValue(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }
function normaliseAuthority(value) { const authority = cleanString(value).toLowerCase(); return Object.values(CONTINUITY_AUTHORITY).includes(authority) ? authority : CONTINUITY_AUTHORITY.AI_INFERRED; }
function isProtectedCanonAuthority(authority) { return PROTECTED_CANON_AUTHORITIES.has(normaliseAuthority(authority)); }

function normaliseCanonFact(item = {}, index = 0) {
  const authority = normaliseAuthority(item.authority);
  return {
    id: cleanString(item.id) || `canon-${index + 1}`,
    key: cleanString(item.key) || null,
    value: item.value === undefined || item.value === null ? null : String(item.value),
    category: CONTINUITY_CATEGORIES.includes(cleanString(item.category)) ? cleanString(item.category) : "other",
    authority,
    protectedCanon: isProtectedCanonAuthority(authority),
    sceneId: cleanString(item.sceneId) || null,
    sourceSceneId: cleanString(item.sourceSceneId) || null,
    characterId: cleanString(item.characterId) || null,
    establishedAt: item.establishedAt || null,
    evidence: cleanString(item.evidence) || null,
    metadata: item.metadata && typeof item.metadata === "object" ? cloneValue(item.metadata) : {},
  };
}

function normaliseCanonFacts(items = []) { return asArray(items).filter((item) => item && typeof item === "object").map(normaliseCanonFact); }
function extractProtectedCanon(items = []) { return normaliseCanonFacts(items).filter((item) => item.protectedCanon === true); }
function buildCanonIndex(items = []) { const index = new Map(); for (const item of extractProtectedCanon(items)) { if (!item.key) continue; if (!index.has(item.key)) index.set(item.key, []); index.get(item.key).push(item); } return index; }

const CONTINUITY_ITEM_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { key: { type: ["string", "null"] }, value: { type: ["string", "null"] }, category: { type: "string", enum: CONTINUITY_CATEGORIES }, sceneId: { type: ["string", "null"] }, reason: { type: ["string", "null"] }, confidence: { type: "number", minimum: 0, maximum: 1 } },
  required: ["key", "value", "category", "sceneId", "reason", "confidence"],
};

const CONTINUITY_CONFLICT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { key: { type: ["string", "null"] }, category: { type: "string", enum: CONTINUITY_CATEGORIES }, existingCanonValue: { type: ["string", "null"] }, proposedValue: { type: ["string", "null"] }, existingSceneId: { type: ["string", "null"] }, currentSceneId: { type: ["string", "null"] }, severity: { type: "string", enum: ["low", "medium", "high", "critical"] }, reason: { type: ["string", "null"] }, requiresCreatorDecision: { type: "boolean" }, confidence: { type: "number", minimum: 0, maximum: 1 } },
  required: ["key", "category", "existingCanonValue", "proposedValue", "existingSceneId", "currentSceneId", "severity", "reason", "requiresCreatorDecision", "confidence"],
};

const CANON_DEPENDENCY_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { key: { type: "string" }, value: { type: ["string", "null"] }, authority: { type: "string", enum: [CONTINUITY_AUTHORITY.CREATOR_CONFIRMED, CONTINUITY_AUTHORITY.CREATOR_APPROVED_AI] }, sceneId: { type: ["string", "null"] } },
  required: ["key", "value", "authority", "sceneId"],
};

const CONTINUITY_AGENT_OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    agentId: { type: "string", enum: [CONTINUITY_AGENT_ID] },
    observations: { type: "array", items: CONTINUITY_ITEM_SCHEMA },
    continuityConflicts: { type: "array", items: CONTINUITY_CONFLICT_SCHEMA },
    provisionalSuggestions: { type: "array", items: CONTINUITY_ITEM_SCHEMA },
    canonDependencies: { type: "array", items: CANON_DEPENDENCY_SCHEMA },
    unresolvedContinuityQuestions: { type: "array", items: CONTINUITY_ITEM_SCHEMA },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    provenance: { type: "object", additionalProperties: false, properties: { source: { type: "string" }, model: { type: ["string", "null"] }, contractVersion: { type: "string" } }, required: ["source", "model", "contractVersion"] },
  },
  required: ["agentId", "observations", "continuityConflicts", "provisionalSuggestions", "canonDependencies", "unresolvedContinuityQuestions", "confidence", "provenance"],
};

const CONTINUITY_AGENT_INSTRUCTIONS = `You are the internal Continuity Agent for iBand Movie Mentor. You NEVER speak directly to the creator. You provide continuity intelligence only for later Mentor synthesis.

FOUNDING LAW: THE AI CANNOT CREATE CANON. THE CREATOR CREATES CANON.

Creator-confirmed facts are protected canon. AI suggestions explicitly approved by the creator may also be supplied as protected canon. AI inference and AI suggestion are NOT canon. Never silently promote inference, assumption, prediction, observation or suggestion into canon. Never overwrite creator-confirmed truth. Never advance CreatorJourneyEngine. Never claim the creator decided something they did not decide. Never resolve a contradiction by inventing an explanation. If current material appears to contradict protected canon, report the conflict. When a conflict could represent an intentional creator change, flag it for Mentor/creator resolution rather than deciding which version wins. Distinguish missing information from contradiction. Do not turn ordinary unspecified details into continuity problems or create unnecessary constraints that reduce creator freedom.

Your specialty includes character and relationship continuity, character knowledge, injuries and physical state, established appearance/costume, props and possessions, object state, locations, chronology, dates/time progression, established environment, previous events, promises/clues, unresolved story threads, cause and effect, entrances/exits, alive/dead state and information learned by characters.

Observations and suggestions are advisory only. continuityConflicts identify possible contradictions. unresolvedContinuityQuestions identify matters genuinely requiring later clarification. canonDependencies may contain ONLY protected canon supplied in the input. Never fabricate a canon dependency. Every suggestion remains mentor-provisional. Return only the required structured output.`;

function validateContinuityWorkOrder(workOrder = {}) {
  const issues = [];
  if (cleanString(workOrder.agentId) !== CONTINUITY_AGENT_ID) issues.push("continuity_agent_identity_required");
  if (workOrder.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (workOrder.mayAdvanceJourney !== false) issues.push("journey_advance_forbidden");
  if (workOrder.mayOverwriteCreatorTruth !== false) issues.push("creator_truth_overwrite_forbidden");
  if (workOrder.mayCreateCanon !== false) issues.push("canon_creation_forbidden");
  if (workOrder.authority !== CONTINUITY_AUTHORITY.MENTOR_PROVISIONAL) issues.push("continuity_authority_must_be_mentor_provisional");
  return { valid: issues.length === 0, issues };
}

function validateCanonDependencies(candidate = {}, protectedCanon = []) {
  const issues = []; const confirmed = new Map();
  for (const fact of extractProtectedCanon(protectedCanon)) { if (!fact.key) continue; confirmed.set([fact.key, String(fact.value ?? ""), fact.authority, fact.sceneId || ""].join("::"), true); }
  for (const dependency of asArray(candidate.canonDependencies)) {
    const identity = [cleanString(dependency?.key), String(dependency?.value ?? ""), normaliseAuthority(dependency?.authority), cleanString(dependency?.sceneId)].join("::");
    if (!confirmed.has(identity)) issues.push(`continuity_dependency_not_protected_canon:${cleanString(dependency?.key) || "missing"}`);
  }
  return issues;
}

function validateContinuityContribution(candidate = {}, { protectedCanon = [] } = {}) {
  const issues = [];
  if (!candidate || typeof candidate !== "object") return { valid: false, issues: ["missing_continuity_contribution"], contribution: null };
  if (cleanString(candidate.agentId) !== CONTINUITY_AGENT_ID) issues.push("continuity_agent_identity_mismatch");
  issues.push(...validateCanonDependencies(candidate, protectedCanon));
  return { valid: issues.length === 0, issues, contribution: { agentId: CONTINUITY_AGENT_ID, observations: asArray(candidate.observations), continuityConflicts: asArray(candidate.continuityConflicts), provisionalSuggestions: asArray(candidate.provisionalSuggestions), canonDependencies: asArray(candidate.canonDependencies), unresolvedContinuityQuestions: asArray(candidate.unresolvedContinuityQuestions), confidence: Number(candidate.confidence || 0), provenance: { ...(candidate.provenance || {}), source: "movie-mentor-continuity-agent", contractVersion: CONTINUITY_CONTRACT_VERSION }, authority: CONTINUITY_AUTHORITY.MENTOR_PROVISIONAL, creatorFacing: false, mayAdvanceJourney: false, mayOverwriteCreatorTruth: false, mayCreateCanon: false, mayPromoteInferenceToCanon: false, requiresMentorSynthesis: true } };
}

function createContinuityWorkOrder({ stageId = null, taskId = null, sceneId = null, creatorMessage = null, semanticIntelligence = {}, creatorConfirmedContext = [], canonFacts = [], currentScene = null, previousScenes = [], projectJourney = null, metadata = {} } = {}) {
  return { agentId: CONTINUITY_AGENT_ID, purpose: "Protect established movie reality across scenes and identify continuity conflicts without creating canon.", input: { stageId: cleanString(stageId) || null, taskId: cleanString(taskId) || null, sceneId: cleanString(sceneId) || null, creatorMessage: cleanString(creatorMessage) || null, semanticIntelligence: cloneValue(semanticIntelligence), creatorConfirmedContext: cloneValue(asArray(creatorConfirmedContext)), canonFacts: cloneValue(normaliseCanonFacts(canonFacts)), currentScene: cloneValue(currentScene), previousScenes: cloneValue(asArray(previousScenes)), projectJourney: cloneValue(projectJourney), metadata: metadata && typeof metadata === "object" ? cloneValue(metadata) : {} }, authority: CONTINUITY_AUTHORITY.MENTOR_PROVISIONAL, creatorFacing: false, mayAdvanceJourney: false, mayOverwriteCreatorTruth: false, mayCreateCanon: false, requiresMentorSynthesis: true };
}

async function executeMovieMentorContinuityAgent(workOrder = {}) {
  const preflight = validateContinuityWorkOrder(workOrder);
  if (!preflight.valid) { const error = new Error("Continuity Agent work order failed Movie Mentor authority preflight."); error.code = "CONTINUITY_WORK_ORDER_INVALID"; error.validationIssues = preflight.issues; throw error; }
  const canonFacts = normaliseCanonFacts(workOrder?.input?.canonFacts || []);
  const protectedCanon = extractProtectedCanon(canonFacts);
  const raw = await executeStructuredAI({ task: "movie-mentor-specialist:continuity", systemInstructions: CONTINUITY_AGENT_INSTRUCTIONS, input: { agentId: CONTINUITY_AGENT_ID, purpose: workOrder?.purpose || null, stageId: workOrder?.input?.stageId || null, taskId: workOrder?.input?.taskId || null, sceneId: workOrder?.input?.sceneId || null, creatorMessage: workOrder?.input?.creatorMessage || null, semanticIntelligence: cloneValue(workOrder?.input?.semanticIntelligence || {}), creatorConfirmedContext: cloneValue(workOrder?.input?.creatorConfirmedContext || []), protectedCanon: cloneValue(protectedCanon), currentScene: cloneValue(workOrder?.input?.currentScene || null), previousScenes: cloneValue(workOrder?.input?.previousScenes || []), projectJourney: cloneValue(workOrder?.input?.projectJourney || null), instruction: "Detect continuity issues only. Never create, alter or promote canon." }, schema: CONTINUITY_AGENT_OUTPUT_SCHEMA, schemaName: "movie_mentor_continuity_contribution", metadata: { continuityAgentVersion: MOVIE_MENTOR_CONTINUITY_AGENT_VERSION, continuityContractVersion: CONTINUITY_CONTRACT_VERSION, creatorTruthDominates: true, aiCannotCreateCanon: true, protectedCanonCount: protectedCanon.length } });
  if (!raw?.structured) { const error = new Error("Continuity Agent provider did not return structured intelligence."); error.code = "CONTINUITY_STRUCTURED_OUTPUT_INVALID"; throw error; }
  raw.structured.provenance = { source: "movie-mentor-continuity-agent", model: raw?.metadata?.model || null, contractVersion: CONTINUITY_CONTRACT_VERSION };
  const validation = validateContinuityContribution(raw.structured, { protectedCanon });
  if (!validation.valid) { const error = new Error("Continuity Agent contribution failed Movie Mentor authority validation."); error.code = "CONTINUITY_CONTRIBUTION_INVALID"; error.validationIssues = validation.issues; throw error; }
  return { success: true, contribution: validation.contribution, usage: raw.usage || null, metadata: { ...(raw.metadata || {}), continuityAgentVersion: MOVIE_MENTOR_CONTINUITY_AGENT_VERSION, continuityContractVersion: CONTINUITY_CONTRACT_VERSION, protectedCanonCount: protectedCanon.length, authority: { creatorTruthDominates: true, aiCannotCreateCanon: true, aiInferenceIsNotCanon: true, aiSuggestionIsNotCanon: true, mayAdvanceJourney: false, maySpeakDirectlyToCreator: false, mayOverwriteCreatorTruth: false, mentorMustSynthesize: true } } };
}

function getContinuityAgentManifest() {
  return { id: CONTINUITY_AGENT_ID, name: "Movie Mentor Continuity Agent", version: MOVIE_MENTOR_CONTINUITY_AGENT_VERSION, contractVersion: CONTINUITY_CONTRACT_VERSION, status: "standalone-not-wired", purpose: "Protect cross-scene factual continuity and identify contradictions without creating canon.", authority: CONTINUITY_AUTHORITY.MENTOR_PROVISIONAL, creatorFacing: false, vendorNeutral: true, providerExecution: "StructuredAIProviderClient", capabilities: ["character-continuity", "relationship-continuity", "knowledge-continuity", "location-continuity", "timeline-continuity", "event-continuity", "injury-continuity", "appearance-continuity", "costume-continuity", "prop-continuity", "object-state-continuity", "environment-continuity", "story-thread-continuity", "cause-effect-continuity", "contradiction-detection"], restrictions: ["cannot-create-canon", "cannot-overwrite-creator-truth", "cannot-promote-ai-inference-to-canon", "cannot-promote-ai-suggestion-to-canon", "cannot-advance-journey", "cannot-speak-directly-to-creator", "cannot-resolve-semantic-ambiguity", "requires-mentor-synthesis"] };
}

export { MOVIE_MENTOR_CONTINUITY_AGENT_VERSION, CONTINUITY_CONTRACT_VERSION, CONTINUITY_AGENT_ID, CONTINUITY_AUTHORITY, PROTECTED_CANON_AUTHORITIES, CONTINUITY_CATEGORIES, CONTINUITY_ITEM_SCHEMA, CONTINUITY_CONFLICT_SCHEMA, CANON_DEPENDENCY_SCHEMA, CONTINUITY_AGENT_OUTPUT_SCHEMA, CONTINUITY_AGENT_INSTRUCTIONS, normaliseAuthority, isProtectedCanonAuthority, normaliseCanonFact, normaliseCanonFacts, extractProtectedCanon, buildCanonIndex, validateContinuityWorkOrder, validateCanonDependencies, validateContinuityContribution, createContinuityWorkOrder, executeMovieMentorContinuityAgent, getContinuityAgentManifest };
export default executeMovieMentorContinuityAgent;
