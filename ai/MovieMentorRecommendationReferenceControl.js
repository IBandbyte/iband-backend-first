const MOVIE_MENTOR_RECOMMENDATION_REFERENCE_CONTROL_VERSION = "1.0.1";
const RECOMMENDATION_REFERENCE_DOMAIN = "iband.movie-mentor.journey-recommendation-reference";
const RECOMMENDATION_REFERENCE_SCHEMA = 1;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function projectMatches(item, projectId) {
  const expected = clean(projectId);
  if (!expected) return true;
  const direct = clean(item?.projectId || item?.metadata?.projectId);
  return !direct || direct === expected;
}

function extractRecommendationEvidence(item) {
  const evidence = item?.metadata?.recommendationReference;
  if (!evidence || typeof evidence !== "object") return null;
  if (clean(evidence.domain) !== RECOMMENDATION_REFERENCE_DOMAIN) return null;
  if (Number(evidence.schema) !== RECOMMENDATION_REFERENCE_SCHEMA) return null;
  if (clean(evidence.authority) !== "mentor-advisory") return null;
  if (evidence.creatorConfirmed !== false) return null;
  if (evidence.mayCreateCanon !== false) return null;
  if (evidence.mayAdvanceJourney !== false) return null;
  if (!clean(evidence.recommendationId)) return null;
  return clone(evidence);
}

function recommendationCandidates(memoryContext = {}, projectId = null) {
  return asArray(memoryContext?.projectMemories)
    .filter((item) => projectMatches(item, projectId))
    .map((item) => {
      const evidence = extractRecommendationEvidence(item);
      if (!evidence) return null;
      const evidenceProjectId = clean(evidence.projectId);
      const expectedProjectId = clean(projectId);
      if (expectedProjectId && evidenceProjectId && evidenceProjectId !== expectedProjectId) return null;
      const turnRevision = Number(evidence?.provenance?.turnRevision);
      return {
        item: clone(item),
        evidence,
        recommendationId: clean(evidence.recommendationId),
        current: evidence?.lifecycle?.current !== false,
        turnRevision: Number.isSafeInteger(turnRevision) && turnRevision >= 0 ? turnRevision : null,
        timestamp: timestamp(item?.updatedAt || item?.createdAt || evidence?.createdAt),
      };
    })
    .filter(Boolean);
}

function selectCurrentRecommendationReference({ memoryContext = {}, projectId = null } = {}) {
  const candidates = recommendationCandidates(memoryContext, projectId);
  if (!candidates.length) {
    return { status: "none", reason: "no-journey-recommendation-evidence", candidates: [] };
  }

  const revisions = candidates
    .map((candidate) => candidate.turnRevision)
    .filter((value) => Number.isSafeInteger(value));

  let latest = candidates;
  if (revisions.length) {
    const highestRevision = Math.max(...revisions);
    latest = candidates.filter((candidate) => candidate.turnRevision === highestRevision);
  } else {
    const newestTimestamp = Math.max(...candidates.map((candidate) => candidate.timestamp));
    latest = candidates.filter((candidate) => candidate.timestamp === newestTimestamp);
  }

  const finalists = latest.filter((candidate) => candidate.current === true);
  if (!finalists.length) {
    return {
      status: "none",
      reason: "latest-journey-recommendation-is-not-current",
      candidates: clone(latest.map((candidate) => candidate.evidence)),
    };
  }

  const distinctIds = [...new Set(finalists.map((candidate) => candidate.recommendationId))];
  if (distinctIds.length !== 1) {
    return {
      status: "ambiguous",
      reason: "competing-current-journey-recommendations",
      candidates: clone(finalists.map((candidate) => candidate.evidence)),
    };
  }

  const chosen = [...finalists].sort((left, right) => right.timestamp - left.timestamp)[0];
  return {
    status: "resolved",
    reason: null,
    recommendationId: chosen.recommendationId,
    evidence: clone(chosen.evidence),
    sourceMemoryId: clean(chosen.item?.id) || null,
  };
}

function recommendationResolvedValue(evidence = {}) {
  const recommendation = evidence?.recommendation || {};
  return {
    recommendationId: clean(evidence?.recommendationId) || null,
    recommendedStageId: clean(recommendation?.recommendedStageId) || null,
    recommendedTaskId: clean(recommendation?.recommendedTaskId) || null,
    recommendedNextStep: clean(recommendation?.recommendedNextStep) || null,
    explanation: clean(recommendation?.explanation) || null,
    alternatives: clone(asArray(recommendation?.alternatives)),
  };
}

export {
  MOVIE_MENTOR_RECOMMENDATION_REFERENCE_CONTROL_VERSION,
  RECOMMENDATION_REFERENCE_DOMAIN,
  RECOMMENDATION_REFERENCE_SCHEMA,
  extractRecommendationEvidence,
  recommendationCandidates,
  selectCurrentRecommendationReference,
  recommendationResolvedValue,
};

export default selectCurrentRecommendationReference;
