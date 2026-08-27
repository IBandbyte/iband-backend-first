const MOVIE_MENTOR_LEGACY_OWNERSHIP_ADOPTION_VERSION = "1.0.0";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function parseTime(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : null;
}

async function certifyLegacyProjectOwnershipAdoption({
  principal = null,
  project = null,
  credential = null,
  verifyAdoptionCredential = null,
  expectedIssuer = null,
  expectedAudience = "iband.movie-mentor.legacy-ownership-adoption",
  now = Date.now(),
} = {}) {
  const principalId = clean(principal?.principalId);
  if (!principalId || principal?.authenticated !== true) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_AUTHENTICATION_REQUIRED",
      "Legacy project adoption requires a deterministically authenticated principal."
    );
  }

  const projectId = clean(project?.id || project?.projectId);
  const identity = project?.identity && typeof project.identity === "object" ? project.identity : null;
  if (!projectId || !identity) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_PROJECT_IDENTITY_REQUIRED",
      "Legacy project adoption requires an immutable Movie Mentor project identity."
    );
  }

  if (typeof verifyAdoptionCredential !== "function") {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_VERIFIER_REQUIRED",
      "Legacy ownership adoption requires an independent trusted migration verifier."
    );
  }

  const evidence = await verifyAdoptionCredential({ credential, principal, project });
  if (!evidence || evidence.verified !== true) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_PROOF_INVALID",
      "Legacy ownership adoption proof was not independently verified."
    );
  }

  const subject = clean(evidence.subject || evidence.principalId);
  const boundProjectId = clean(evidence.projectId);
  const adoptionId = clean(evidence.adoptionId);
  const issuer = clean(evidence.issuer);
  const audience = clean(evidence.audience);
  const verificationMethod = clean(evidence.verificationMethod);
  const issuedAtMs = parseTime(evidence.issuedAt);
  const expiresAtMs = parseTime(evidence.expiresAt);

  if (!subject || subject !== principalId) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_PRINCIPAL_CONFLICT",
      "Legacy adoption proof is bound to a different authenticated principal."
    );
  }
  if (!boundProjectId || boundProjectId !== projectId) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_PROJECT_CONFLICT",
      "Legacy adoption proof is bound to a different project."
    );
  }
  if (!adoptionId) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_ID_REQUIRED",
      "Legacy adoption proof requires a one-time adoption identity."
    );
  }
  if (!issuer || (clean(expectedIssuer) && issuer !== clean(expectedIssuer))) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_ISSUER_INVALID",
      "Legacy adoption proof issuer is not trusted for this migration."
    );
  }
  if (!audience || audience !== clean(expectedAudience)) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_AUDIENCE_INVALID",
      "Legacy adoption proof audience is invalid."
    );
  }
  if (!verificationMethod) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_VERIFICATION_METHOD_REQUIRED",
      "Legacy adoption proof must identify its deterministic verification method."
    );
  }
  if (evidence.revoked === true) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_PROOF_REVOKED",
      "Legacy adoption proof has been revoked."
    );
  }
  if (issuedAtMs === null || expiresAtMs === null || expiresAtMs <= issuedAtMs) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_TIME_INVALID",
      "Legacy adoption proof has invalid issuance or expiry bounds."
    );
  }
  if (issuedAtMs > now + 30_000) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_NOT_YET_VALID",
      "Legacy adoption proof was issued in the future."
    );
  }
  if (expiresAtMs <= now) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_EXPIRED",
      "Legacy adoption proof has expired."
    );
  }

  const identityDomain = clean(identity.domain);
  const identitySchema = Number.isSafeInteger(identity.schema) ? identity.schema : null;
  const identityIssuance = clean(identity.issuance);
  const evidenceDomain = clean(evidence.projectIdentity?.domain);
  const evidenceSchema = Number.isSafeInteger(evidence.projectIdentity?.schema)
    ? evidence.projectIdentity.schema
    : null;
  const evidenceIssuance = clean(evidence.projectIdentity?.issuance);

  if (
    !identityDomain || identitySchema === null || !identityIssuance ||
    evidenceDomain !== identityDomain ||
    evidenceSchema !== identitySchema ||
    evidenceIssuance !== identityIssuance
  ) {
    fail(
      "MOVIE_MENTOR_LEGACY_ADOPTION_IDENTITY_CONFLICT",
      "Legacy adoption proof does not bind the immutable project identity classification."
    );
  }

  return Object.freeze({
    certified: true,
    domain: "iband.movie-mentor.legacy-ownership-adoption-attestation",
    schema: 1,
    adoptionId,
    principalId,
    projectId,
    projectIdentity: Object.freeze({
      domain: identityDomain,
      schema: identitySchema,
      issuance: identityIssuance,
    }),
    issuer,
    audience,
    verificationMethod,
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
}

export {
  MOVIE_MENTOR_LEGACY_OWNERSHIP_ADOPTION_VERSION,
  certifyLegacyProjectOwnershipAdoption,
};
export default certifyLegacyProjectOwnershipAdoption;
