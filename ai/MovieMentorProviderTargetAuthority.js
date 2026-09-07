import crypto from "node:crypto";

const VERSION = "1.1.0";
const DOMAIN = "iband.movie-mentor.provider-target-authority";
const RECOVERY_MODES = Object.freeze(["known-response-id-retrieval", "none"]);
const CREDENTIAL_QUERY_KEYS = Object.freeze(new Set([
  "apikey",
  "key",
  "token",
  "accesstoken",
  "authorization",
  "auth",
  "signature",
  "sig",
  "secret",
  "clientsecret",
  "password",
  "pwd",
  "credential",
  "credentials",
  "transientsecret",
]));

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function normalizedQueryKey(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function credentialLikeQueryKey(value) {
  return CREDENTIAL_QUERY_KEYS.has(normalizedQueryKey(value));
}

function sanitizeProviderRoute(value) {
  const raw = text(value);
  if (!raw) fail("MOVIE_MENTOR_PROVIDER_TARGET_ROUTE_REQUIRED", "Provider target identity requires a configured provider route.");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail("MOVIE_MENTOR_PROVIDER_TARGET_ROUTE_INVALID", "Provider target route is invalid.");
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    fail("MOVIE_MENTOR_PROVIDER_TARGET_ROUTE_INVALID", "Provider target route must use HTTP or HTTPS.");
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";

  const semanticQuery = Array.from(parsed.searchParams.entries())
    .filter(([key]) => !credentialLikeQueryKey(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyOrder = leftKey.localeCompare(rightKey);
      return keyOrder !== 0 ? keyOrder : leftValue.localeCompare(rightValue);
    });

  parsed.search = "";
  for (const [key, queryValue] of semanticQuery) parsed.searchParams.append(key, queryValue);

  return parsed.toString();
}

function routeFingerprint(provider, route) {
  return crypto.createHash("sha256").update(`${text(provider)}|${sanitizeProviderRoute(route)}`).digest("hex");
}

function normalizeMovieMentorProviderTarget(value = {}) {
  const provider = text(value.provider).toLowerCase();
  const adapter = text(value.adapter);
  const fingerprint = text(value.routeFingerprint);
  const recoveryMode = text(value.recoveryMode);
  if (!provider || !adapter || !/^[a-f0-9]{64}$/.test(fingerprint) || !RECOVERY_MODES.includes(recoveryMode)) {
    fail("MOVIE_MENTOR_PROVIDER_TARGET_INVALID", "Provider target identity is incomplete or invalid.");
  }
  return freeze({ provider, adapter, routeFingerprint: fingerprint, recoveryMode });
}

function describeCurrentMovieMentorProviderTarget({ env = process.env } = {}) {
  const provider = text(env?.IBAND_AI_PROVIDER || "openai").toLowerCase();
  if (provider === "openai") {
    const route = text(env?.IBAND_AI_BASE_URL) || "https://api.openai.com/v1/responses";
    return normalizeMovieMentorProviderTarget({
      provider,
      adapter: "openai-responses",
      routeFingerprint: routeFingerprint(provider, route),
      recoveryMode: "known-response-id-retrieval",
    });
  }
  if (provider === "generic-http") {
    const route = text(env?.IBAND_AI_BASE_URL);
    if (!route) fail("MOVIE_MENTOR_PROVIDER_TARGET_ROUTE_REQUIRED", "Generic HTTP provider target identity requires IBAND_AI_BASE_URL.");
    return normalizeMovieMentorProviderTarget({
      provider,
      adapter: "generic-http",
      routeFingerprint: routeFingerprint(provider, route),
      recoveryMode: "none",
    });
  }
  fail("MOVIE_MENTOR_PROVIDER_TARGET_UNSUPPORTED", "Unsupported Movie Mentor provider cannot acquire provider target authority.", { provider: provider || null });
}

function sameMovieMentorProviderTarget(left, right) {
  const a = normalizeMovieMentorProviderTarget(left);
  const b = normalizeMovieMentorProviderTarget(right);
  return a.provider === b.provider
    && a.adapter === b.adapter
    && a.routeFingerprint === b.routeFingerprint
    && a.recoveryMode === b.recoveryMode;
}

export {
  VERSION as MOVIE_MENTOR_PROVIDER_TARGET_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_PROVIDER_TARGET_AUTHORITY_DOMAIN,
  RECOVERY_MODES as MOVIE_MENTOR_PROVIDER_RECOVERY_MODES,
  sanitizeProviderRoute,
  routeFingerprint as fingerprintMovieMentorProviderRoute,
  normalizeMovieMentorProviderTarget,
  describeCurrentMovieMentorProviderTarget,
  sameMovieMentorProviderTarget,
};

export default describeCurrentMovieMentorProviderTarget;
