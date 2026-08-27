import { createMovieMentorJourneyRecoveryPublicationBoundary } from "./MovieMentorJourneyRecoveryPublicationBoundary.js";

const MOVIE_MENTOR_JOURNEY_RECOVERY_HTTP_TRANSPORT_ADAPTER_VERSION = "1.0.0";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function publicError(statusCode, code, message) {
  return Object.freeze({
    statusCode,
    body: Object.freeze({ success: false, code, message }),
  });
}

function classifyError(error) {
  const code = cleanString(error?.code);

  if ([
    "MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED",
    "MOVIE_MENTOR_AUTH_VERIFIER_REQUIRED",
    "MOVIE_MENTOR_AUTH_NOT_VERIFIED",
    "MOVIE_MENTOR_AUTH_EXPIRED",
    "MOVIE_MENTOR_AUTH_REVOKED",
    "MOVIE_MENTOR_AUTH_ISSUER_MISMATCH",
    "MOVIE_MENTOR_AUTH_AUDIENCE_MISMATCH",
  ].includes(code)) {
    return publicError(401, "MOVIE_MENTOR_RECOVERY_UNAUTHENTICATED", "Recovery authentication failed.");
  }

  if ([
    "MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_AUTHORIZATION_INVALID",
  ].includes(code)) {
    return publicError(403, "MOVIE_MENTOR_RECOVERY_FORBIDDEN", "Recovery publication is not authorized.");
  }

  if ([
    "MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_ROLLBACK_REJECTED",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_SPLIT_BRAIN",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_LINEAGE_CONFLICT",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_PROJECT_CONFLICT",
  ].includes(code)) {
    return publicError(409, "MOVIE_MENTOR_RECOVERY_CONFLICT", "Recovery publication conflicts with durable recovery reality.");
  }

  if ([
    "MOVIE_MENTOR_JOURNEY_RECOVERY_PROJECT_REQUIRED",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_EXPECTED_REVISION_REQUIRED",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_ENVELOPE_INVALID",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORITY_INJECTION",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_HTTP_BODY_REQUIRED",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_HTTP_PROJECT_BODY_FORBIDDEN",
  ].includes(code)) {
    return publicError(400, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST", "Recovery request is invalid.");
  }

  if ([
    "MOVIE_MENTOR_JOURNEY_RECOVERY_STORE_NOT_CONFIGURED",
    "MOVIE_MENTOR_JOURNEY_RECOVERY_STORE_UNAVAILABLE",
  ].includes(code)) {
    return publicError(503, "MOVIE_MENTOR_RECOVERY_UNAVAILABLE", "Recovery publication is temporarily unavailable.");
  }

  return publicError(500, "MOVIE_MENTOR_RECOVERY_INTERNAL_ERROR", "Recovery publication failed.");
}

function createMovieMentorJourneyRecoveryHttpTransportAdapter({
  publicationBoundary = createMovieMentorJourneyRecoveryPublicationBoundary(),
} = {}) {
  if (typeof publicationBoundary?.publish !== "function") {
    const error = new Error("Recovery HTTP transport requires the authorized publication boundary.");
    error.code = "MOVIE_MENTOR_JOURNEY_RECOVERY_HTTP_PUBLICATION_BOUNDARY_REQUIRED";
    throw error;
  }

  async function handle({ request = null, projectId = null } = {}) {
    const pid = cleanString(projectId);
    if (!pid) {
      return publicError(400, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST", "Recovery request is invalid.");
    }

    const body = request?.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return publicError(400, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST", "Recovery request is invalid.");
    }

    // projectId is selected by the eventual server route, never by untrusted body data.
    if (Object.prototype.hasOwnProperty.call(body, "projectId")) {
      return publicError(400, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST", "Recovery request is invalid.");
    }

    const expectedRecoveryRevision = body.expectedRecoveryRevision;
    if (!Number.isSafeInteger(expectedRecoveryRevision) || expectedRecoveryRevision < 0) {
      return publicError(400, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST", "Recovery request is invalid.");
    }

    if (!body.envelope || typeof body.envelope !== "object" || Array.isArray(body.envelope)) {
      return publicError(400, "MOVIE_MENTOR_RECOVERY_INVALID_REQUEST", "Recovery request is invalid.");
    }

    try {
      const publication = await publicationBoundary.publish({
        request,
        projectId: pid,
        expectedRecoveryRevision,
        envelope: body.envelope,
      });

      return Object.freeze({
        statusCode: 200,
        body: Object.freeze({
          success: true,
          status: publication.recoveryStatus,
          projectId: publication.projectId,
          recoveryRevision: publication.recoveryRevision,
          recoveryGeneration: publication.recoveryGeneration,
          lineageId: publication.lineageId,
          authorityGeneration: publication.authorityGeneration,
          progressionRevision: publication.progressionRevision,
          envelopeFingerprint: publication.envelopeFingerprint,
          capturedAt: publication.capturedAt,
        }),
      });
    } catch (error) {
      return classifyError(error);
    }
  }

  return Object.freeze({
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_HTTP_TRANSPORT_ADAPTER_VERSION,
    handle,
  });
}

export {
  MOVIE_MENTOR_JOURNEY_RECOVERY_HTTP_TRANSPORT_ADAPTER_VERSION,
  classifyError as classifyMovieMentorJourneyRecoveryHttpError,
  createMovieMentorJourneyRecoveryHttpTransportAdapter,
};

export default createMovieMentorJourneyRecoveryHttpTransportAdapter;
