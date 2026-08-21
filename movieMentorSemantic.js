import express from "express";
import {
  MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION,
  getMovieMentorSemanticProviderStatus,
  interpretMovieMentorSemantics
} from "./ai/MovieMentorSemanticInterpreter.js";

const router = express.Router();

const SEMANTIC_GATEWAY_VERSION = "2.0.0";
const SEMANTIC_CONTRACT_VERSION = MOVIE_MENTOR_SEMANTIC_CONTRACT_VERSION;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractCreatorMessage(providerRequest) {
  return cleanString(
    providerRequest?.input?.message ||
      providerRequest?.message ||
      providerRequest?.context?.activeIdea ||
      ""
  );
}

router.get("/health", (req, res) => {
  const provider = getMovieMentorSemanticProviderStatus();

  return res.json({
    success: true,
    service: "movie-mentor-semantic-gateway",
    version: SEMANTIC_GATEWAY_VERSION,
    contractVersion: SEMANTIC_CONTRACT_VERSION,
    semanticProviderConfigured: provider.configured,
    providerName: provider.provider,
    model: provider.model,
    interpreterVersion: provider.interpreterVersion,
    safety: {
      preserveCreatorLanguage: true,
      creatorConfirmedMeaningOutranksInference: true,
      provisionalInferenceIsNotCreatorTruth: true,
      unfamiliarTerminologyRequiresClarification: true,
      doNotGuessMeaning: true,
      materialAmbiguityBlocksProgression: true,
      deterministicPlanningIsNotSemanticUnderstanding: true,
      structuredSemanticIntelligenceRequiredForAdvance: true
    }
  });
});

router.post("/interpret", async (req, res) => {
  const providerRequest =
    req.body && typeof req.body === "object" ? req.body : {};

  if (!extractCreatorMessage(providerRequest)) {
    return res.status(400).json({
      success: false,
      code: "CREATOR_MESSAGE_REQUIRED",
      message: "A creator message is required for semantic interpretation.",
      semanticIntelligenceAvailable: false,
      safety: { mayAdvanceJourney: false }
    });
  }

  try {
    const result = await interpretMovieMentorSemantics(providerRequest);

    if (!result?.structured?.movieJourneyIntelligence) {
      return res.status(422).json({
        success: false,
        code: "SEMANTIC_INTELLIGENCE_MISSING",
        message:
          "The semantic interpreter did not return the required structured Movie Journey intelligence contract.",
        semanticIntelligenceAvailable: false,
        safety: {
          doNotGuessMeaning: true,
          mayAdvanceJourney: false
        }
      });
    }

    return res.json({
      ...result,
      metadata: {
        ...(result.metadata || {}),
        semanticGatewayVersion: SEMANTIC_GATEWAY_VERSION,
        semanticContractVersion: SEMANTIC_CONTRACT_VERSION,
        semanticIntelligenceAvailable: true
      }
    });
  } catch (error) {
    const code = cleanString(error?.code) ||
      (error?.name === "AbortError"
        ? "SEMANTIC_PROVIDER_TIMEOUT"
        : "SEMANTIC_PROVIDER_FAILED");

    const status =
      code === "SEMANTIC_PROVIDER_NOT_CONFIGURED" ? 503 :
      code === "CREATOR_MESSAGE_REQUIRED" ? 400 :
      code === "SEMANTIC_INTELLIGENCE_INVALID" ? 422 :
      error?.name === "AbortError" ? 504 : 502;

    return res.status(status).json({
      success: false,
      code,
      message:
        error instanceof Error ? error.message : "Semantic provider failed.",
      validationIssues: Array.isArray(error?.validationIssues)
        ? error.validationIssues
        : [],
      semanticIntelligenceAvailable: false,
      safety: {
        preserveCreatorLanguage: true,
        creatorConfirmedMeaningOutranksInference: true,
        provisionalInferenceIsNotCreatorTruth: true,
        unfamiliarTerminologyRequiresClarification: true,
        doNotGuessMeaning: true,
        materialAmbiguityBlocksProgression: true,
        deterministicPlanningIsNotSemanticUnderstanding: true,
        structuredSemanticIntelligenceRequiredForAdvance: true,
        mayAdvanceJourney: false
      }
    });
  }
});

export {
  SEMANTIC_GATEWAY_VERSION,
  SEMANTIC_CONTRACT_VERSION
};

export default router;
