import express from "express";

const router = express.Router();

const SEMANTIC_GATEWAY_VERSION = "1.0.0";
const SEMANTIC_CONTRACT_VERSION = "1.0.0";

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

function getProviderConfig() {
  return {
    url: cleanString(process.env.IBAND_MOVIE_SEMANTIC_PROVIDER_URL),
    key: cleanString(process.env.IBAND_MOVIE_SEMANTIC_PROVIDER_KEY),
    name:
      cleanString(process.env.IBAND_MOVIE_SEMANTIC_PROVIDER_NAME) ||
      "external-semantic-provider",
    timeoutMs: Math.max(
      1000,
      Number(process.env.IBAND_MOVIE_SEMANTIC_TIMEOUT_MS || 30000) || 30000
    )
  };
}

function extractCreatorMessage(providerRequest) {
  return cleanString(
    providerRequest?.input?.message ||
      providerRequest?.message ||
      providerRequest?.context?.activeIdea ||
      ""
  );
}

function normalizeStructuredIntelligence(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const source =
    candidate.movieJourneyIntelligence ||
    candidate.journeyIntelligence ||
    candidate.creatorJourneyIntelligence ||
    candidate;

  if (!source || typeof source !== "object") {
    return null;
  }

  const clarificationNeeded = asArray(source.clarificationNeeded).map(
    (item) => ({
      key: cleanString(item?.key) || null,
      expression: cleanString(item?.expression) || null,
      question: cleanString(item?.question) || null,
      reason: cleanString(item?.reason) || null,
      material: item?.material !== false,
      metadata:
        item?.metadata && typeof item.metadata === "object"
          ? cloneValue(item.metadata)
          : {}
    })
  );

  const materialClarificationRequired = clarificationNeeded.some(
    (item) => item.material !== false
  );

  return {
    understoodContext: asArray(source.understoodContext),
    provisionalContext: asArray(source.provisionalContext),
    unresolvedContext: asArray(source.unresolvedContext),
    clarificationNeeded,
    readyToAdvance:
      source.readyToAdvance === true && !materialClarificationRequired,
    recommendedStageId:
      cleanString(source.recommendedStageId) || "story-direction",
    recommendedTaskId: cleanString(source.recommendedTaskId) || null,
    nextAction:
      source.nextAction && typeof source.nextAction === "object"
        ? cloneValue(source.nextAction)
        : null,
    resumeNote: cleanString(source.resumeNote) || null,
    metadata: {
      ...(source.metadata && typeof source.metadata === "object"
        ? cloneValue(source.metadata)
        : {}),
      semanticGatewayVersion: SEMANTIC_GATEWAY_VERSION,
      semanticContractVersion: SEMANTIC_CONTRACT_VERSION,
      materialClarificationOverridesAdvance: true
    }
  };
}

function normalizeProviderResponse(payload, providerName) {
  const text = cleanString(
    payload?.text ||
      payload?.content ||
      payload?.response?.text ||
      payload?.response ||
      ""
  );

  const structured = normalizeStructuredIntelligence(
    payload?.structured ||
      payload?.data ||
      payload?.movieJourneyIntelligence ||
      payload?.journeyIntelligence ||
      null
  );

  return {
    text,
    structured: structured
      ? { movieJourneyIntelligence: structured }
      : null,
    metadata: {
      semanticProvider: providerName,
      semanticGatewayVersion: SEMANTIC_GATEWAY_VERSION,
      semanticContractVersion: SEMANTIC_CONTRACT_VERSION,
      semanticIntelligenceAvailable: Boolean(structured)
    }
  };
}

async function callSemanticProvider(providerRequest, config) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(config.key ? { Authorization: `Bearer ${config.key}` } : {})
      },
      body: JSON.stringify({
        task: "movie-mentor-semantic-interpretation",
        contractVersion: SEMANTIC_CONTRACT_VERSION,
        safetyContract: {
          preserveCreatorLanguage: true,
          creatorConfirmedMeaningOutranksInference: true,
          provisionalInferenceIsNotCreatorTruth: true,
          unfamiliarTerminologyRequiresClarification: true,
          materialAmbiguityBlocksProgression: true,
          doNotGuessMeaning: true,
          structuredSemanticIntelligenceRequiredForAdvance: true
        },
        request: providerRequest
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { text };
    }

    if (!response.ok) {
      const error = new Error(
        cleanString(payload?.message) ||
          cleanString(payload?.error) ||
          `Semantic provider request failed (${response.status}).`
      );
      error.status = response.status;
      throw error;
    }

    return normalizeProviderResponse(payload, config.name);
  } finally {
    clearTimeout(timer);
  }
}

router.get("/health", (req, res) => {
  const config = getProviderConfig();

  return res.json({
    success: true,
    service: "movie-mentor-semantic-gateway",
    version: SEMANTIC_GATEWAY_VERSION,
    contractVersion: SEMANTIC_CONTRACT_VERSION,
    semanticProviderConfigured: Boolean(config.url),
    providerName: config.url ? config.name : null,
    safety: {
      doNotGuessMeaning: true,
      materialAmbiguityBlocksProgression: true,
      structuredSemanticIntelligenceRequiredForAdvance: true
    }
  });
});

router.post("/interpret", async (req, res) => {
  const providerRequest =
    req.body && typeof req.body === "object" ? req.body : {};
  const creatorMessage = extractCreatorMessage(providerRequest);

  if (!creatorMessage) {
    return res.status(400).json({
      success: false,
      message: "A creator message is required for semantic interpretation."
    });
  }

  const config = getProviderConfig();

  if (!config.url) {
    return res.status(503).json({
      success: false,
      code: "SEMANTIC_PROVIDER_NOT_CONFIGURED",
      message:
        "Movie Mentor semantic intelligence is not configured. The caller must fall back safely without claiming semantic understanding.",
      semanticIntelligenceAvailable: false,
      safety: {
        doNotGuessMeaning: true,
        mayAdvanceJourney: false
      }
    });
  }

  try {
    const result = await callSemanticProvider(providerRequest, config);

    if (!result.structured?.movieJourneyIntelligence) {
      return res.status(422).json({
        success: false,
        code: "SEMANTIC_INTELLIGENCE_MISSING",
        message:
          "The semantic provider did not return the required structured Movie Journey intelligence contract.",
        semanticIntelligenceAvailable: false,
        safety: {
          doNotGuessMeaning: true,
          mayAdvanceJourney: false
        }
      });
    }

    return res.json(result);
  } catch (error) {
    const status = error?.name === "AbortError" ? 504 : 502;

    return res.status(status).json({
      success: false,
      code:
        error?.name === "AbortError"
          ? "SEMANTIC_PROVIDER_TIMEOUT"
          : "SEMANTIC_PROVIDER_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Semantic provider failed.",
      semanticIntelligenceAvailable: false,
      safety: {
        doNotGuessMeaning: true,
        mayAdvanceJourney: false
      }
    });
  }
});

export {
  SEMANTIC_GATEWAY_VERSION,
  SEMANTIC_CONTRACT_VERSION,
  normalizeStructuredIntelligence,
  normalizeProviderResponse
};

export default router;
