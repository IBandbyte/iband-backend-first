import {
  MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,
  SPECIALIST_CONTRACT_VERSION,
  createSpecialistContributionSchema,
  validateWorkOrder,
  validateContribution,
} from "./MovieMentorSpecialistExecutor.js";
import {
  MOVIE_MENTOR_SYNTHESIS_VERSION,
  MENTOR_SYNTHESIS_CONTRACT_VERSION,
  createSynthesisSchema,
  validateSynthesisRequest,
} from "./MovieMentorSynthesisEngine.js";
import { assertObedienceClaims } from "./MovieMentorContinuationObedienceControl.js";
import { reconstructRecoveredStructuredAI } from "./MovieMentorRecoveredStructuredResult.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.recovered-task-result";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function reconstructRecoveredMovieMentorSpecialistResult({
  input: workOrder = {},
  providerOperation = null,
  recoveredProviderResponse = null,
  recovery = null,
} = {}) {
  const preflight = validateWorkOrder(workOrder);
  if (!preflight.valid) {
    fail("SPECIALIST_WORK_ORDER_INVALID", "Recovered specialist work order failed the original authority preflight.", {
      validationIssues: preflight.issues,
    });
  }
  if (preflight.agentId === "continuity") {
    fail(
      "CONTINUITY_RECOVERY_INPUT_AUTHORITY_REQUIRED",
      "Continuity recovery requires the exact historical derived-cache input universe to be durably bound before reconstruction can be authorized.",
      { retryable: true },
    );
  }

  const task = `movie-mentor-specialist:${preflight.agentId}`;
  const raw = reconstructRecoveredStructuredAI({
    recoveredProviderResponse,
    providerOperation,
    task,
    schema: createSpecialistContributionSchema(preflight.agentId),
    metadata: {
      specialistExecutorVersion: MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,
      contractVersion: SPECIALIST_CONTRACT_VERSION,
    },
  });
  if (!raw?.structured) {
    fail("SPECIALIST_STRUCTURED_OUTPUT_INVALID", "Recovered specialist response did not return structured contribution.");
  }

  raw.structured.provenance = {
    source: "movie-mentor-specialist-agent",
    model: raw?.metadata?.model || null,
    contractVersion: SPECIALIST_CONTRACT_VERSION,
  };
  const validation = validateContribution(raw.structured, workOrder);
  if (!validation.valid) {
    fail("SPECIALIST_CONTRIBUTION_INVALID", "Recovered specialist contribution failed the original iBand authority validation.", {
      validationIssues: validation.issues,
    });
  }

  return Object.freeze({
    success: true,
    contribution: validation.contribution,
    usage: raw.usage || null,
    metadata: Object.freeze({
      ...(raw.metadata || {}),
      specialistExecutorVersion: MOVIE_MENTOR_SPECIALIST_EXECUTOR_VERSION,
      specialistContractVersion: SPECIALIST_CONTRACT_VERSION,
      localAuthorityRevalidated: true,
      recoveredFromHistoricalProviderOperation: true,
      recoveryOwnerId: text(recovery?.recoveryOwnerId) || null,
      recoveryLeaseGeneration: Number.isSafeInteger(recovery?.recoveryLeaseGeneration) ? recovery.recoveryLeaseGeneration : null,
    }),
  });
}

function reconstructRecoveredMovieMentorSynthesisResult({
  input = {},
  providerOperation = null,
  recoveredProviderResponse = null,
  recovery = null,
} = {}) {
  const requestValidation = validateSynthesisRequest(input);
  if (!requestValidation.valid) {
    fail(
      requestValidation.issues.some((issue) => issue.includes("clarification") || issue.includes("continuity_must_be_consistent"))
        ? "MENTOR_SYNTHESIS_BLOCKED_BY_CLARIFICATION"
        : "MENTOR_SYNTHESIS_REQUEST_INVALID",
      "Recovered synthesis request failed the original authority preflight.",
      { validationIssues: requestValidation.issues },
    );
  }

  const contributionIds = [...new Set(array(input.contributions).map((item) => text(item?.agentId)).filter(Boolean))];
  const raw = reconstructRecoveredStructuredAI({
    recoveredProviderResponse,
    providerOperation,
    task: "movie-mentor-synthesis",
    schema: createSynthesisSchema(contributionIds),
    metadata: {
      synthesisVersion: MOVIE_MENTOR_SYNTHESIS_VERSION,
      contractVersion: MENTOR_SYNTHESIS_CONTRACT_VERSION,
    },
  });
  if (!raw?.structured || !text(raw.structured.text)) {
    fail("MENTOR_SYNTHESIS_OUTPUT_INVALID", "Recovered Mentor synthesis did not return valid structured output.");
  }

  const contributionIdSet = new Set(contributionIds);
  const used = array(raw.structured.usedContributionAgentIds);
  const deferred = array(raw.structured.deferredContributionAgentIds);
  const invalidIds = [...used, ...deferred].filter((id) => !contributionIdSet.has(id));
  if (invalidIds.length) {
    fail("MENTOR_SYNTHESIS_OUTPUT_INVALID", "Recovered Mentor synthesis referenced an unavailable specialist contribution.", {
      validationIssues: invalidIds.map((id) => `unknown_contribution:${id}`),
    });
  }

  try {
    assertObedienceClaims(
      raw.structured.continuationObedienceClaims,
      input.continuationObedienceEnvelope || { references: [], requiredReferenceIds: [] },
      { allowNotApplicable: false, requireAll: true },
    );
  } catch (error) {
    fail("MENTOR_SYNTHESIS_CONTINUATION_OBEDIENCE_FAILED", "Recovered Mentor synthesis violated validated continuation meaning.", {
      validationIssues: array(error?.validationIssues),
    });
  }

  return Object.freeze({
    success: true,
    text: text(raw.structured.text),
    continuationObedienceClaims: array(raw.structured.continuationObedienceClaims),
    synthesisDecision: Object.freeze({
      usedContributionAgentIds: used,
      deferredContributionAgentIds: deferred,
      conflictsHandled: array(raw.structured.conflictsHandled),
      confidence: Number(raw.structured.confidence || 0),
      provenance: Object.freeze({
        source: "movie-mentor-synthesis",
        model: raw?.metadata?.model || null,
        contractVersion: MENTOR_SYNTHESIS_CONTRACT_VERSION,
      }),
    }),
    authority: Object.freeze({
      creatorTruthDominates: true,
      currentCreatorDecisionsOnly: true,
      derivedContinuityIsBindingButNotCanon: true,
      validatedSemanticsOutrankSpecialists: true,
      continuationReferencesImmutable: true,
      specialistContributionsAreProvisional: true,
      specialistContentBecomesCanonicalTruth: false,
      mayAdvanceJourney: false,
      singleCreatorFacingMentor: true,
    }),
    usage: raw.usage || null,
    metadata: Object.freeze({
      ...(raw.metadata || {}),
      synthesisVersion: MOVIE_MENTOR_SYNTHESIS_VERSION,
      contractVersion: MENTOR_SYNTHESIS_CONTRACT_VERSION,
      localAuthorityRevalidated: true,
      recoveredFromHistoricalProviderOperation: true,
      recoveryOwnerId: text(recovery?.recoveryOwnerId) || null,
      recoveryLeaseGeneration: Number.isSafeInteger(recovery?.recoveryLeaseGeneration) ? recovery.recoveryLeaseGeneration : null,
    }),
  });
}

export {
  VERSION as MOVIE_MENTOR_RECOVERED_TASK_RESULT_VERSION,
  DOMAIN as MOVIE_MENTOR_RECOVERED_TASK_RESULT_DOMAIN,
  reconstructRecoveredMovieMentorSpecialistResult,
  reconstructRecoveredMovieMentorSynthesisResult,
};
