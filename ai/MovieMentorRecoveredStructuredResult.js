import { validateStructuredOutput } from "./StructuredAIProviderClient.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.recovered-structured-result";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
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

function extractOpenAIOutputText(payload = {}) {
  if (cleanString(payload?.output_text)) return payload.output_text;
  for (const item of asArray(payload?.output)) {
    for (const content of asArray(item?.content)) {
      if (cleanString(content?.text)) return content.text;
    }
  }
  return "";
}

function parseJsonText(value) {
  const text = cleanString(value);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function reconstructRecoveredStructuredAI({
  recoveredProviderResponse = null,
  providerOperation = null,
  schema = null,
  task = null,
  metadata = {},
} = {}) {
  const providerOperationId = cleanString(providerOperation?.providerOperationId);
  const operationTask = cleanString(providerOperation?.task);
  const expectedTask = cleanString(task);
  const responseId = cleanString(recoveredProviderResponse?.id);
  if (!providerOperationId || !operationTask || !expectedTask || operationTask !== expectedTask || !responseId) {
    fail(
      "AI_RECOVERED_PROVIDER_OPERATION_BINDING_INVALID",
      "Recovered structured provider bytes must bind the exact historical operation task and response identity.",
      { retryable: false },
    );
  }

  const structured = parseJsonText(extractOpenAIOutputText(recoveredProviderResponse));
  const validation = validateStructuredOutput(structured, schema);
  if (!validation.valid) {
    fail(
      "AI_PROVIDER_STRUCTURED_OUTPUT_SCHEMA_INVALID",
      "Recovered AI provider structured output failed the original local schema validation.",
      {
        retryable: false,
        providerFailureCategory: "structured-output",
        validationIssues: validation.issues.slice(0, 100),
        providerEffectEvidence: { provider: "openai", externalEffectId: responseId },
      },
    );
  }

  return Object.freeze({
    structured: clone(structured),
    usage: clone(recoveredProviderResponse?.usage || null),
    metadata: Object.freeze({
      provider: "openai",
      model: cleanString(recoveredProviderResponse?.model) || null,
      responseId,
      task: expectedTask,
      providerOperationId,
      localSchemaValidated: true,
      recoveredFromHistoricalProviderOperation: true,
      ...clone(metadata || {}),
    }),
  });
}

export {
  VERSION as MOVIE_MENTOR_RECOVERED_STRUCTURED_RESULT_VERSION,
  DOMAIN as MOVIE_MENTOR_RECOVERED_STRUCTURED_RESULT_DOMAIN,
  extractOpenAIOutputText as extractRecoveredStructuredOpenAIOutputText,
  reconstructRecoveredStructuredAI,
};

export default reconstructRecoveredStructuredAI;
