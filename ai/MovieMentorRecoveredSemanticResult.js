import {
  MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
  MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
  validateIntelligence,
  normalizeCreatorConfirmedContext,
} from "./MovieMentorSemanticInterpreter.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.recovered-semantic-result";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function extractCreatorMessage(request = {}) {
  return cleanString(request?.input?.message || request?.message || request?.context?.activeIdea || "");
}

function parseJsonText(value) {
  const text = cleanString(value);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function extractOpenAIOutputText(payload = {}) {
  if (cleanString(payload?.output_text)) return payload.output_text;
  for (const item of asArray(payload?.output)) {
    for (const content of asArray(item?.content)) {
      if (cleanString(content?.text)) return content.text;
    }
  }
  return "";
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function reconstructRecoveredMovieMentorSemanticResult({
  input = {},
  providerOperation = null,
  recoveredProviderResponse = null,
  recovery = null,
} = {}) {
  const creatorMessage = extractCreatorMessage(input);
  if (!creatorMessage) {
    fail("CREATOR_MESSAGE_REQUIRED", "A creator message is required for semantic interpretation.");
  }

  const providerOperationId = cleanString(providerOperation?.providerOperationId);
  const responseId = cleanString(recoveredProviderResponse?.id);
  if (!providerOperationId || !responseId) {
    fail(
      "SEMANTIC_RECOVERED_PROVIDER_IDENTITY_INVALID",
      "Recovered semantic bytes require exact historical provider-operation and response identity.",
      { retryable: false },
    );
  }

  const candidate = parseJsonText(extractOpenAIOutputText(recoveredProviderResponse));
  if (!candidate) {
    fail(
      "SEMANTIC_STRUCTURED_OUTPUT_INVALID",
      "Recovered semantic provider response did not contain valid structured JSON.",
      { retryable: false, providerEffectEvidence: { provider: "openai", externalEffectId: responseId } },
    );
  }

  const creatorConfirmedContext = normalizeCreatorConfirmedContext(input);
  const validation = validateIntelligence(candidate, { creatorConfirmedContext, creatorMessage });
  if (!validation.valid) {
    fail(
      "SEMANTIC_INTELLIGENCE_INVALID",
      "Recovered semantic intelligence failed the original creator-authority validation contract.",
      {
        retryable: false,
        validationIssues: cloneValue(validation.issues || []),
        providerEffectEvidence: { provider: "openai", externalEffectId: responseId },
      },
    );
  }

  return Object.freeze({
    text: "",
    structured: Object.freeze({ movieJourneyIntelligence: cloneValue(validation.intelligence) }),
    usage: cloneValue(recoveredProviderResponse?.usage || null),
    metadata: Object.freeze({
      provider: "openai",
      model: cleanString(recoveredProviderResponse?.model) || null,
      responseId,
      providerOperationId,
      semanticInterpreterVersion: MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
      semanticContractVersion: MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
      localAuthorityRevalidated: true,
      recoveredFromHistoricalProviderOperation: true,
      recoveryOwnerId: cleanString(recovery?.recoveryOwnerId) || null,
      recoveryLeaseGeneration: Number.isSafeInteger(recovery?.recoveryLeaseGeneration)
        ? recovery.recoveryLeaseGeneration
        : null,
      safetyCorrections: cloneValue(validation.safetyCorrections || []),
    }),
  });
}

export {
  VERSION as MOVIE_MENTOR_RECOVERED_SEMANTIC_RESULT_VERSION,
  DOMAIN as MOVIE_MENTOR_RECOVERED_SEMANTIC_RESULT_DOMAIN,
  extractOpenAIOutputText as extractRecoveredSemanticOpenAIOutputText,
  reconstructRecoveredMovieMentorSemanticResult,
};

export default reconstructRecoveredMovieMentorSemanticResult;
