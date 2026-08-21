const MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION = "1.1.0";
const MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION = "1.2.0";

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

function stableValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
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
1. The creator's exact current-turn wording is authoritative.
2. Creator-confirmed meanings from the existing journey are authoritative unless the creator explicitly changes or corrects them in the current turn.
3. Never silently replace, reinterpret or "correct" creator terminology.
4. If a term, phrase, cultural reference, slang expression, invented word, relationship, intention or movie concept is unfamiliar or materially uncertain, do not guess. Put it in clarificationNeeded and ask one precise creator-facing question.
5. Inference may only appear in provisionalContext and must use confidenceSource=model-provisional. Provisional inference is never creator truth.
6. Creator-confirmed or creator-explicit meaning outranks model inference, prior memory, common usage and deterministic planning signals.
7. Any material unresolved ambiguity forces readyToAdvance=false.
8. readyToAdvance may be true only when the supplied creator language is semantically understood well enough for the canonical Movie Journey to move forward without inventing a creator decision.
9. Adaptive Mentor actions, question policies and progression signals are context only. They are not evidence of semantic understanding.
10. Preserve uncertainty explicitly. Do not manufacture confidence.
11. understoodContext may contain only creator-confirmed or creator-explicit meaning. Never place model-provisional content there.
12. If the current creator message explicitly corrects a previously confirmed meaning, represent the current meaning in understoodContext with confidenceSource=creator-explicit so it can supersede the older decision.
13. Return only the required structured semantic intelligence.`;

function extractCreatorMessage(providerRequest) {
  return cleanString(
    providerRequest?.input?.message ||
      providerRequest?.message ||
      providerRequest?.context?.activeIdea ||
      ""
  );
}

function normalizeCreatorConfirmedContext(providerRequest) {
  return asArray(
    providerRequest?.context?.creatorConfirmedContext ||
      providerRequest?.context?.confirmedMeaning ||
      providerRequest?.context?.confirmedMeanings ||
      []
  )
    .filter((item) => item && typeof item === "object" && cleanString(item.key))
    .map((item) => ({
      key: cleanString(item.key),
      value: cloneValue(item.value),
      authority: "creator",
      stageId: cleanString(item.stageId) || null,
      sceneId: cleanString(item.sceneId) || null,
      reason: cleanString(item.reason) || null,
      createdAt: item.createdAt || null
    }));
}

function buildSemanticInput(providerRequest) {
  return {
    creatorMessage: extractCreatorMessage(providerRequest),
    creatorConfirmedContext: normalizeCreatorConfirmedContext(providerRequest),
    movieJourneyContext: cloneValue(providerRequest?.context || {}),
    requestMetadata: cloneValue(providerRequest?.options?.metadata || {}),
    instruction:
      "Interpret the creator's current language conservatively. Current explicit corrections may supersede prior creator-confirmed context; model inference may never do so."
  };
}

function normalizeContextItem(item) {
  if (!item || typeof item !== "object") return null;
  return {
    key: cleanString(item.key) || null,
    value: item.value === null || item.value === undefined ? null : String(item.value),
    evidence: cleanString(item.evidence) || null,
    confidenceSource: cleanString(item.confidenceSource) || ""
  };
}

function normalizeIntelligence(candidate) {
  if (!candidate || typeof candidate !== "object") return null;

  const normalizeItems = (value) =>
    asArray(value).map(normalizeContextItem).filter(Boolean);

  const clarificationNeeded = asArray(candidate.clarificationNeeded).map((item) => ({
    key: cleanString(item?.key) || null,
    expression: cleanString(item?.expression) || null,
    question: cleanString(item?.question) || null,
    reason: cleanString(item?.reason) || null,
    material: item?.material !== false
  }));

  return {
    understoodContext: normalizeItems(candidate.understoodContext),
    provisionalContext: normalizeItems(candidate.provisionalContext),
    unresolvedContext: normalizeItems(candidate.unresolvedContext),
    clarificationNeeded,
    readyToAdvance: candidate.readyToAdvance === true,
    recommendedStageId: cleanString(candidate.recommendedStageId) || null,
    recommendedTaskId: cleanString(candidate.recommendedTaskId) || null,
    nextAction:
      candidate.nextAction && typeof candidate.nextAction === "object"
        ? cloneValue(candidate.nextAction)
        : null,
    resumeNote: cleanString(candidate.resumeNote) || null
  };
}

function applyCreatorAuthority(normalized, creatorConfirmedContext = []) {
  const intelligence = cloneValue(normalized);
  const safetyCorrections = [];
  const fatalIssues = [];
  const confirmedByKey = new Map(
    asArray(creatorConfirmedContext)
      .filter((item) => cleanString(item?.key))
      .map((item) => [cleanString(item.key), item])
  );

  const explicitCurrentKeys = new Set(
    intelligence.understoodContext
      .filter((item) => item.confidenceSource === "creator-explicit" && item.key)
      .map((item) => item.key)
  );

  for (const item of intelligence.understoodContext) {
    if (!item.key) continue;
    const confirmed = confirmedByKey.get(item.key);
    if (!confirmed) continue;

    if (item.confidenceSource === "creator-confirmed") {
      if (stableValue(item.value) !== stableValue(confirmed.value)) {
        fatalIssues.push(`creator_confirmed_conflict:${item.key}`);
      }
    } else if (
      item.confidenceSource === "creator-explicit" &&
      stableValue(item.value) !== stableValue(confirmed.value)
    ) {
      safetyCorrections.push(`current_creator_correction_supersedes_prior:${item.key}`);
    }
  }

  intelligence.provisionalContext = intelligence.provisionalContext.filter((item) => {
    if (!item.key || !confirmedByKey.has(item.key)) return true;
    if (explicitCurrentKeys.has(item.key)) return true;
    safetyCorrections.push(`removed_provisional_conflict_with_creator_truth:${item.key}`);
    return false;
  });

  return { intelligence, safetyCorrections, fatalIssues };
}

function validateIntelligence(candidate, { creatorConfirmedContext = [] } = {}) {
  const normalized = normalizeIntelligence(candidate);
  const issues = [];
  const fatalIssues = [];
  const safetyCorrections = [];

  if (!normalized) {
    return {
      valid: false,
      intelligence: null,
      issues: ["missing_structured_intelligence"],
      fatalIssues: ["missing_structured_intelligence"],
      safetyCorrections: []
    };
  }

  if (
    normalized.understoodContext.some(
      (item) =>
        item.confidenceSource !== "creator-confirmed" &&
        item.confidenceSource !== "creator-explicit"
    )
  ) {
    fatalIssues.push("understood_context_requires_creator_authority");
  }

  if (
    normalized.provisionalContext.some(
      (item) => item.confidenceSource !== "model-provisional"
    )
  ) {
    fatalIssues.push("provisional_context_requires_model_provisional_source");
  }

  for (const item of normalized.clarificationNeeded) {
    if (item.material && (!item.question || !item.reason)) {
      fatalIssues.push("material_clarification_requires_question_and_reason");
    }
  }

  const authorityResult = applyCreatorAuthority(normalized, creatorConfirmedContext);
  fatalIssues.push(...authorityResult.fatalIssues);
  safetyCorrections.push(...authorityResult.safetyCorrections);

  const intelligence = authorityResult.intelligence;

  if (intelligence.unresolvedContext.length > 0 && intelligence.readyToAdvance) {
    intelligence.readyToAdvance = false;
    safetyCorrections.push("unresolved_context_forced_ready_to_advance_false");
  }

  if (
    intelligence.clarificationNeeded.some((item) => item.material) &&
    intelligence.readyToAdvance
  ) {
    intelligence.readyToAdvance = false;
    safetyCorrections.push("material_clarification_forced_ready_to_advance_false");
  }

  if (fatalIssues.length > 0) {
    intelligence.readyToAdvance = false;
  }

  issues.push(...fatalIssues, ...safetyCorrections);

  return {
    valid: fatalIssues.length === 0,
    intelligence,
    issues,
    fatalIssues,
    safetyCorrections
  };
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
  const model = cleanString(process.env.IBAND_AI_MODEL);

  if (provider === "openai") {
    return {
      provider,
      model,
      url: cleanString(process.env.IBAND_AI_BASE_URL) || "https://api.openai.com/v1/responses",
      key: cleanString(process.env.IBAND_AI_API_KEY || process.env.OPENAI_API_KEY),
      requiresKey: true,
      requiresModel: true,
      timeoutMs: Math.max(1000, Number(process.env.IBAND_AI_TIMEOUT_MS || 30000) || 30000)
    };
  }

  if (provider === "generic-http") {
    return {
      provider,
      model,
      url: cleanString(process.env.IBAND_AI_BASE_URL),
      key: cleanString(process.env.IBAND_AI_API_KEY),
      requiresKey: false,
      requiresModel: false,
      timeoutMs: Math.max(1000, Number(process.env.IBAND_AI_TIMEOUT_MS || 30000) || 30000)
    };
  }

  return {
    provider,
    model,
    url: "",
    key: "",
    requiresKey: false,
    requiresModel: false,
    timeoutMs: 30000
  };
}

function isProviderConfigured(config) {
  return Boolean(
    config?.url &&
      (!config.requiresKey || config.key) &&
      (!config.requiresModel || config.model)
  );
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
  if (!isProviderConfigured(config)) {
    const error = new Error(
      "Movie Mentor semantic AI provider is not configured. Configure the selected provider's required IBAND_AI_* environment variables."
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

  const validation = validateIntelligence(raw.candidate, {
    creatorConfirmedContext: normalizeCreatorConfirmedContext(providerRequest)
  });

  if (!validation.intelligence || !validation.valid) {
    const error = new Error(
      "Semantic AI provider returned intelligence that failed iBand's authority/safety validation."
    );
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
          creatorConfirmedMeaningAuthoritative: true,
          currentCreatorCorrectionMaySupersedePriorTruth: true,
          provisionalInferenceIsNotCreatorTruth: true,
          materialAmbiguityBlocksProgression: true,
          validationIssues: validation.issues,
          safetyCorrections: validation.safetyCorrections
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
    configured: isProviderConfigured(config),
    provider: config.provider || null,
    model: config.model || null,
    interpreterVersion: MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
    contractVersion: MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
    requiresKey: Boolean(config.requiresKey),
    requiresModel: Boolean(config.requiresModel)
  };
}

export {
  MOVIE_MENTOR_SEMANTIC_INTERPRETER_VERSION,
  MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
  MOVIE_JOURNEY_INTELLIGENCE_SCHEMA,
  SYSTEM_INSTRUCTIONS,
  buildSemanticInput,
  normalizeCreatorConfirmedContext,
  normalizeIntelligence,
  applyCreatorAuthority,
  validateIntelligence,
  getMovieMentorSemanticProviderStatus,
  interpretMovieMentorSemantics
};

export default interpretMovieMentorSemantics;
