const MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION = "1.0.1";
const MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION = "1.1.0";

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

const CONTEXT_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    key: { type: ["string", "null"] },
    value: { type: ["string", "null"] },
    evidence: { type: ["string", "null"] },
    confidenceSource: {
      type: "string",
      enum: ["creator-confirmed", "creator-explicit", "model-provisional"]
    }
  },
  required: ["key", "value", "evidence", "confidenceSource"]
};

const MOVIE_JOURNEY_INTELLIGENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    understoodContext: { type: "array", items: CONTEXT_ITEM_SCHEMA },
    provisionalContext: { type: "array", items: CONTEXT_ITEM_SCHEMA },
    unresolvedContext: { type: "array", items: CONTEXT_ITEM_SCHEMA },
    clarificationNeeded: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: ["string", "null"] },
          expression: { type: ["string", "null"] },
          question: { type: ["string", "null"] },
          reason: { type: ["string", "null"] },
          material: { type: "boolean" }
        },
        required: ["key", "expression", "question", "reason", "material"]
      }
    },
    readyToAdvance: { type: "boolean" },
    recommendedStageId: { type: ["string", "null"] },
    recommendedTaskId: { type: ["string", "null"] },
    nextAction: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: ["string", "null"] },
            label: { type: ["string", "null"] },
            reason: { type: ["string", "null"] }
          },
          required: ["type", "label", "reason"]
        },
        { type: "null" }
      ]
    },
    resumeNote: { type: ["string", "null"] }
  },
  required: [
    "understoodContext",
    "provisionalContext",
    "unresolvedContext",
    "clarificationNeeded",
    "readyToAdvance",
    "recommendedStageId",
    "recommendedTaskId",
    "nextAction",
    "resumeNote"
  ]
};

const SYSTEM_INSTRUCTIONS = `You are iBand Movie Mentor's Semantic Interpreter.
Your job is interpretation, not creative authorship and not journey planning.

Non-negotiable rules:
1. The creator's exact wording and creator-confirmed meanings are authoritative.
2. Never silently replace, reinterpret or "correct" creator terminology.
3. If a term, phrase, cultural reference, slang expression, invented word, relationship, intention or movie concept is unfamiliar or materially uncertain, do not guess. Put it in clarificationNeeded and ask one precise creator-facing question.
4. Inference may only appear in provisionalContext and must use confidenceSource=model-provisional. Provisional inference is never creator truth.
5. Creator-confirmed meaning outranks model inference, prior memory, common usage and deterministic planning signals.
6. Any material unresolved ambiguity forces readyToAdvance=false.
7. readyToAdvance may be true only when the supplied creator language is semantically understood well enough for the canonical Movie Journey to move forward without inventing a creator decision.
8. Adaptive Mentor actions, question policies and progression signals are context only. They are not evidence of semantic understanding.
9. Preserve uncertainty explicitly. Do not manufacture confidence.
10. understoodContext may contain only creator-confirmed or creator-explicit meaning. Never place model-provisional content there.
11. Return only the required structured semantic intelligence.`;

function extractCreatorMessage(providerRequest) {
  return cleanString(
    providerRequest?.input?.message ||
      providerRequest?.message ||
      providerRequest?.context?.activeIdea ||
      ""
  );
}

function buildSemanticInput(providerRequest) {
  return {
    creatorMessage: extractCreatorMessage(providerRequest),
    creatorConfirmedContext: cloneValue(
      providerRequest?.context?.creatorConfirmedContext ||
        providerRequest?.context?.confirmedMeaning ||
        providerRequest?.context?.confirmedMeanings ||
        []
    ),
    movieJourneyContext: cloneValue(providerRequest?.context || {}),
    requestMetadata: cloneValue(providerRequest?.options?.metadata || {}),
    instruction:
      "Interpret the creator's language conservatively under the safety contract. Do not perform the deterministic Mentor planner's job."
  };
}

function normalizeIntelligence(candidate) {
  if (!candidate || typeof candidate !== "object") return null;

  const clarificationNeeded = asArray(candidate.clarificationNeeded).map((item) => ({
    key: cleanString(item?.key) || null,
    expression: cleanString(item?.expression) || null,
    question: cleanString(item?.question) || null,
    reason: cleanString(item?.reason) || null,
    material: item?.material !== false
  }));

  const materialClarificationRequired = clarificationNeeded.some(
    (item) => item.material !== false
  );

  return {
    understoodContext: asArray(candidate.understoodContext),
    provisionalContext: asArray(candidate.provisionalContext),
    unresolvedContext: asArray(candidate.unresolvedContext),
    clarificationNeeded,
    readyToAdvance:
      candidate.readyToAdvance === true && !materialClarificationRequired,
    recommendedStageId: cleanString(candidate.recommendedStageId) || null,
    recommendedTaskId: cleanString(candidate.recommendedTaskId) || null,
    nextAction:
      candidate.nextAction && typeof candidate.nextAction === "object"
        ? cloneValue(candidate.nextAction)
        : null,
    resumeNote: cleanString(candidate.resumeNote) || null
  };
}

function validateIntelligence(candidate) {
  const normalized = normalizeIntelligence(candidate);
  const issues = [];

  if (!normalized) {
    return { valid: false, intelligence: null, issues: ["missing_structured_intelligence"] };
  }

  if (
    normalized.understoodContext.some(
      (item) => item?.confidenceSource === "model-provisional"
    )
  ) {
    issues.push("provisional_inference_cannot_be_understood_context");
    normalized.readyToAdvance = false;
  }

  if (
    normalized.provisionalContext.some(
      (item) => item?.confidenceSource !== "model-provisional"
    )
  ) {
    issues.push("provisional_context_requires_model_provisional_source");
    normalized.readyToAdvance = false;
  }

  for (const item of normalized.clarificationNeeded) {
    if (item.material && (!item.question || !item.reason)) {
      issues.push("material_clarification_requires_question_and_reason");
      normalized.readyToAdvance = false;
    }
  }

  if (normalized.readyToAdvance && normalized.unresolvedContext.length > 0) {
    issues.push("unresolved_context_blocks_advance");
    normalized.readyToAdvance = false;
  }

  if (normalized.readyToAdvance && normalized.clarificationNeeded.some((item) => item.material)) {
    issues.push("material_clarification_blocks_advance");
    normalized.readyToAdvance = false;
  }

  return { valid: issues.length === 0, intelligence: normalized, issues };
}

function parseJsonText(text) {
  const value = cleanString(text);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractOpenAIOutputText(payload) {
  if (cleanString(payload?.output_text)) return payload.output_text;

  for (const item of asArray(payload?.output)) {
    for (const content of asArray(item?.content)) {
      if (cleanString(content?.text)) return content.text;
    }
  }

  return "";
}

function getProviderConfig() {
  const provider = cleanString(process.env.IBAND_AI_PROVIDER || "openai").toLowerCase();
  const model = cleanString(process.env.IBAND_AI_MODEL || "gpt-5.6-terra");

  if (provider === "openai") {
    return {
      provider,
      model,
      url: cleanString(process.env.IBAND_AI_BASE_URL) || "https://api.openai.com/v1/responses",
      key: cleanString(process.env.IBAND_AI_API_KEY || process.env.OPENAI_API_KEY),
      timeoutMs: Math.max(1000, Number(process.env.IBAND_AI_TIMEOUT_MS || 30000) || 30000)
    };
  }

  if (provider === "generic-http") {
    return {
      provider,
      model,
      url: cleanString(process.env.IBAND_AI_BASE_URL),
      key: cleanString(process.env.IBAND_AI_API_KEY),
      timeoutMs: Math.max(1000, Number(process.env.IBAND_AI_TIMEOUT_MS || 30000) || 30000)
    };
  }

  return { provider, model, url: "", key: "", timeoutMs: 30000 };
}

async function postJson(url, body, { key, timeoutMs, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      const error = new Error(
        cleanString(payload?.error?.message) ||
          cleanString(payload?.message) ||
          `AI provider failed (${response.status}).`
      );
      error.status = response.status;
      error.data = payload;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function interpretWithOpenAI(providerRequest, config) {
  const semanticInput = buildSemanticInput(providerRequest);
  const payload = await postJson(
    config.url,
    {
      model: config.model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: JSON.stringify(semanticInput),
      text: {
        format: {
          type: "json_schema",
          name: "movie_journey_intelligence",
          strict: true,
          schema: MOVIE_JOURNEY_INTELLIGENCE_SCHEMA
        }
      }
    },
    config
  );

  return {
    candidate: parseJsonText(extractOpenAIOutputText(payload)),
    usage: payload?.usage || null,
    providerMetadata: {
      provider: "openai",
      model: payload?.model || config.model,
      responseId: payload?.id || null
    }
  };
}

async function interpretWithGenericHttp(providerRequest, config) {
  const payload = await postJson(
    config.url,
    {
      task: "movie-mentor-semantic-interpretation",
      contractVersion: MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
      systemInstructions: SYSTEM_INSTRUCTIONS,
      schema: MOVIE_JOURNEY_INTELLIGENCE_SCHEMA,
      input: buildSemanticInput(providerRequest)
    },
    config
  );

  const candidate =
    payload?.movieJourneyIntelligence ||
    payload?.structured?.movieJourneyIntelligence ||
    payload?.structured ||
    payload?.data ||
    parseJsonText(payload?.text);

  return {
    candidate,
    usage: payload?.usage || null,
    providerMetadata: {
      provider: "generic-http",
      model: payload?.model || config.model || null,
      responseId: payload?.id || null
    }
  };
}

async function interpretMovieMentorSemantics(providerRequest = {}) {
  const creatorMessage = extractCreatorMessage(providerRequest);
  if (!creatorMessage) {
    const error = new Error("A creator message is required for semantic interpretation.");
    error.code = "CREATOR_MESSAGE_REQUIRED";
    throw error;
  }

  const config = getProviderConfig();
  if (!config.url || !config.key) {
    const error = new Error(
      "Movie Mentor semantic AI provider is not configured. Configure IBAND_AI_PROVIDER, IBAND_AI_MODEL and IBAND_AI_API_KEY."
    );
    error.code = "SEMANTIC_PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  let raw;
  if (config.provider === "openai") {
    raw = await interpretWithOpenAI(providerRequest, config);
  } else if (config.provider === "generic-http") {
    raw = await interpretWithGenericHttp(providerRequest, config);
  } else {
    const error = new Error(`Unsupported semantic AI provider: ${config.provider}`);
    error.code = "SEMANTIC_PROVIDER_UNSUPPORTED";
    throw error;
  }

  const validation = validateIntelligence(raw.candidate);
  if (!validation.intelligence) {
    const error = new Error("Semantic AI provider did not return valid structured intelligence.");
    error.code = "SEMANTIC_INTELLIGENCE_INVALID";
    error.validationIssues = validation.issues;
    throw error;
  }

  return {
    text: "",
    structured: {
      movieJourneyIntelligence: {
        ...validation.intelligence,
        metadata: {
          semanticInterpreterVersion: MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
          semanticContractVersion: MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
          creatorLanguageAuthoritative: true,
          provisionalInferenceIsNotCreatorTruth: true,
          materialAmbiguityBlocksProgression: true,
          validationIssues: validation.issues
        }
      }
    },
    usage: raw.usage,
    metadata: raw.providerMetadata
  };
}

function getMovieMentorSemanticProviderStatus() {
  const config = getProviderConfig();
  return {
    configured: Boolean(config.url && config.key),
    provider: config.provider || null,
    model: config.model || null,
    interpreterVersion: MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
    contractVersion: MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION
  };
}

export {
  MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
  MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
  MOVIE_JOURNEY_INTELLIGENCE_SCHEMA,
  SYSTEM_INSTRUCTIONS,
  buildSemanticInput,
  normalizeIntelligence,
  validateIntelligence,
  getMovieMentorSemanticProviderStatus,
  interpretMovieMentorSemantics
};

export default interpretMovieMentorSemantics;
