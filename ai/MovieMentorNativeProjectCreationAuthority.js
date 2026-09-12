import crypto from "node:crypto";
import { deriveMovieMentorPrincipal } from "./MovieMentorDeterministicPrincipalAdapter.js";

const MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_VERSION = "1.0.0";
const MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_DOMAIN = "iband.movie-mentor.native-project-creation-authority";
const MOVIE_MENTOR_PROJECT_IDENTITY_DOMAIN = "iband.movie-mentor.project";
const MOVIE_MENTOR_PROJECT_IDENTITY_SCHEMA = 1;
const MOVIE_MENTOR_PROJECT_IDENTITY_ISSUANCE = "secure-web-crypto";
const MOVIE_MENTOR_NATIVE_PROJECT_CREATION_ESTABLISHMENT_TYPE = "native-project-creation";

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }
function canonicalProjectId(projectId) {
  const value = text(projectId);
  const uuid = /^movie-project-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const randomBytesFallback = /^movie-project-[0-9a-f]{32}$/i;
  return Boolean(value && (uuid.test(value) || randomBytesFallback.test(value)));
}
function inspectNativeProjectIdentity({ projectId = null, identity = null } = {}) {
  const pid = text(projectId);
  if (!canonicalProjectId(pid)) return Object.freeze({ valid: false, reason: "project-id-invalid" });
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) return Object.freeze({ valid: false, reason: "identity-required" });
  if (text(identity.domain) !== MOVIE_MENTOR_PROJECT_IDENTITY_DOMAIN) return Object.freeze({ valid: false, reason: "identity-domain-invalid" });
  if (Number(identity.schema) !== MOVIE_MENTOR_PROJECT_IDENTITY_SCHEMA) return Object.freeze({ valid: false, reason: "identity-schema-invalid" });
  if (text(identity.issuance) !== MOVIE_MENTOR_PROJECT_IDENTITY_ISSUANCE) return Object.freeze({ valid: false, reason: "identity-issuance-invalid" });
  if (identity.legacy === true) return Object.freeze({ valid: false, reason: "legacy-project-not-native" });
  return Object.freeze({ valid: true, projectId: pid, identity: Object.freeze({ domain: MOVIE_MENTOR_PROJECT_IDENTITY_DOMAIN, schema: MOVIE_MENTOR_PROJECT_IDENTITY_SCHEMA, issuance: MOVIE_MENTOR_PROJECT_IDENTITY_ISSUANCE, legacy: false }) });
}
function deriveNativeProjectCreationAuthorityId({ principalId, projectId } = {}) {
  const principal = text(principalId), project = text(projectId);
  if (!principal || !project) fail("MOVIE_MENTOR_NATIVE_PROJECT_CREATION_BINDING_REQUIRED", "Native project creation authority requires authenticated principal and canonical project identity.");
  const digest = crypto.createHash("sha256").update(JSON.stringify({ domain: MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_DOMAIN, schema: 1, principalId: principal, projectId: project, identityDomain: MOVIE_MENTOR_PROJECT_IDENTITY_DOMAIN, identitySchema: MOVIE_MENTOR_PROJECT_IDENTITY_SCHEMA, issuance: MOVIE_MENTOR_PROJECT_IDENTITY_ISSUANCE })).digest("hex");
  return `movie-mentor-native-project-creation:${digest}`;
}
function createMovieMentorNativeProjectCreationAuthority({ verifyCredential = null, expectedIssuer = null, expectedAudience = null, derivePrincipal = deriveMovieMentorPrincipal, ownershipAuthority = null } = {}) {
  if (typeof verifyCredential !== "function") fail("MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTH_VERIFIER_REQUIRED", "Native project creation requires the production credential verifier.");
  if (typeof derivePrincipal !== "function") fail("MOVIE_MENTOR_NATIVE_PROJECT_CREATION_PRINCIPAL_ADAPTER_REQUIRED", "Native project creation requires deterministic principal derivation.");
  if (typeof ownershipAuthority?.establishNativeOwnership !== "function") fail("MOVIE_MENTOR_NATIVE_PROJECT_CREATION_OWNERSHIP_AUTHORITY_REQUIRED", "Native project creation requires durable project ownership establishment authority.");

  async function establishFromRequest({ request = null, projectId = null, identity = null } = {}) {
    const inspected = inspectNativeProjectIdentity({ projectId, identity });
    if (!inspected.valid) fail("MOVIE_MENTOR_NATIVE_PROJECT_IDENTITY_INVALID", "Native project creation requires the exact canonical secure-web-crypto project identity contract.", { reason: inspected.reason });
    const principal = await derivePrincipal({ request, verifyCredential, expectedIssuer: text(expectedIssuer) || null, expectedAudience: text(expectedAudience) || null, now: new Date() });
    if (principal?.authenticated !== true || !text(principal?.principalId)) fail("MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHENTICATION_REQUIRED", "Native project creation requires an authenticated creator principal.");
    const principalId = text(principal.principalId);
    const authorityId = deriveNativeProjectCreationAuthorityId({ principalId, projectId: inspected.projectId });
    const result = await ownershipAuthority.establishNativeOwnership({
      principal,
      projectId: inspected.projectId,
      establishmentAuthority: Object.freeze({
        verified: true,
        type: MOVIE_MENTOR_NATIVE_PROJECT_CREATION_ESTABLISHMENT_TYPE,
        projectId: inspected.projectId,
        principalId,
        authorityId,
      }),
    });
    const ownership = result?.ownership;
    if (!ownership || text(ownership.projectId) !== inspected.projectId || text(ownership.ownerPrincipalId) !== principalId) fail("MOVIE_MENTOR_NATIVE_PROJECT_CREATION_OWNERSHIP_RESULT_INVALID", "Durable project ownership establishment did not return the exact authenticated creator/project universe.");
    return Object.freeze({
      status: text(result?.status) || "established",
      projectId: inspected.projectId,
      identity: inspected.identity,
      ownership: Object.freeze({
        projectId: text(ownership.projectId),
        ownershipRevision: Number.isSafeInteger(ownership.ownershipRevision) ? ownership.ownershipRevision : null,
        ownershipReference: text(ownership.ownershipReference) || null,
        status: text(ownership.status) || "active",
      }),
    });
  }

  const status = Object.freeze({
    version: MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_DOMAIN,
    authenticatedCreatorRequired: true,
    canonicalSecureWebCryptoIdentityRequired: true,
    serverDerivedEstablishmentAuthority: true,
    deterministicRetryAuthority: true,
    durableOwnershipAuthorityRequired: true,
    clientCannotMintOwnershipAuthority: true,
  });
  return Object.freeze({ version: MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_VERSION, domain: MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_DOMAIN, establishFromRequest, getStatus: () => status });
}

export {
  MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_VERSION,
  MOVIE_MENTOR_NATIVE_PROJECT_CREATION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_NATIVE_PROJECT_CREATION_ESTABLISHMENT_TYPE,
  inspectNativeProjectIdentity,
  deriveNativeProjectCreationAuthorityId,
  createMovieMentorNativeProjectCreationAuthority,
};
export default createMovieMentorNativeProjectCreationAuthority;
