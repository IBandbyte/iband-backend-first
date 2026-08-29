const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.production-browser-origin-authority";
const ENV_KEY = "MOVIE_MENTOR_ALLOWED_BROWSER_ORIGINS";
const DEFAULT_PROTECTED_PATH_PREFIXES = Object.freeze([
  "/api/movie-mentor",
  "/api/movie-mentor-recovery",
]);

function freeze(value) {
  return Object.freeze(value);
}

function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return { ok: false, reason: "origin-must-be-string" };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, reason: "origin-must-not-be-empty" };
  }
  if (trimmed === "*" || trimmed.includes("*")) {
    return { ok: false, reason: "wildcard-origin-forbidden" };
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "origin-must-be-valid-url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "origin-protocol-must-be-http-or-https" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "origin-userinfo-forbidden" };
  }
  if (url.search || url.hash) {
    return { ok: false, reason: "origin-query-or-fragment-forbidden" };
  }
  if (url.pathname && url.pathname !== "/") {
    return { ok: false, reason: "origin-path-forbidden" };
  }

  return { ok: true, origin: url.origin };
}

function parseAllowedOrigins(rawOrigins) {
  if (rawOrigins == null || String(rawOrigins).trim() === "") {
    return freeze({ ready: true, configured: false, allowedOrigins: freeze([]), issues: freeze([]) });
  }

  const entries = String(rawOrigins).split(",");
  const allowed = [];
  const issues = [];

  for (const entry of entries) {
    const parsed = normalizeOrigin(entry);
    if (!parsed.ok) {
      issues.push(freeze({ entry: String(entry).trim(), reason: parsed.reason }));
      continue;
    }
    if (!allowed.includes(parsed.origin)) {
      allowed.push(parsed.origin);
    }
  }

  if (issues.length > 0) {
    return freeze({
      ready: false,
      configured: true,
      allowedOrigins: freeze([]),
      issues: freeze(issues),
    });
  }

  return freeze({
    ready: true,
    configured: true,
    allowedOrigins: freeze(allowed),
    issues: freeze([]),
  });
}

function pathMatchesProtectedSurface(pathname, prefixes) {
  if (typeof pathname !== "string") return false;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function createMovieMentorProductionBrowserOriginAuthority({
  env = process.env,
  rawOrigins = env?.[ENV_KEY],
  protectedPathPrefixes = DEFAULT_PROTECTED_PATH_PREFIXES,
} = {}) {
  const parsed = parseAllowedOrigins(rawOrigins);
  const prefixes = freeze([...protectedPathPrefixes]);
  const allowedSet = new Set(parsed.allowedOrigins);

  function isOriginAllowed(origin) {
    const normalized = normalizeOrigin(origin);
    return parsed.ready === true && normalized.ok === true && allowedSet.has(normalized.origin);
  }

  function authorizeRequest({ origin = null, path = "" } = {}) {
    if (!origin) {
      return freeze({ allowed: true, browserRequest: false, protectedSurface: pathMatchesProtectedSurface(path, prefixes), reason: "no-browser-origin" });
    }

    const protectedSurface = pathMatchesProtectedSurface(path, prefixes);
    if (!protectedSurface) {
      return freeze({ allowed: true, browserRequest: true, protectedSurface: false, reason: "public-surface" });
    }

    if (parsed.ready !== true) {
      return freeze({ allowed: false, browserRequest: true, protectedSurface: true, reason: "origin-authority-not-ready" });
    }

    if (!isOriginAllowed(origin)) {
      return freeze({ allowed: false, browserRequest: true, protectedSurface: true, reason: "browser-origin-not-authorized" });
    }

    return freeze({ allowed: true, browserRequest: true, protectedSurface: true, reason: "browser-origin-authorized" });
  }

  function createCorsOptions() {
    return {
      origin(origin, callback) {
        if (!origin) return callback(null, false);
        return callback(null, isOriginAllowed(origin));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      optionsSuccessStatus: 204,
    };
  }

  return freeze({
    version: VERSION,
    domain: DOMAIN,
    envKey: ENV_KEY,
    ready: parsed.ready,
    configured: parsed.configured,
    allowedOrigins: parsed.allowedOrigins,
    issues: parsed.issues,
    protectedPathPrefixes: prefixes,
    isOriginAllowed,
    authorizeRequest,
    createCorsOptions,
  });
}

export {
  VERSION as MOVIE_MENTOR_PRODUCTION_BROWSER_ORIGIN_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_PRODUCTION_BROWSER_ORIGIN_AUTHORITY_DOMAIN,
  ENV_KEY as MOVIE_MENTOR_PRODUCTION_BROWSER_ORIGIN_ENV_KEY,
  DEFAULT_PROTECTED_PATH_PREFIXES as MOVIE_MENTOR_PRODUCTION_BROWSER_ORIGIN_PROTECTED_PATH_PREFIXES,
  normalizeOrigin,
  parseAllowedOrigins,
  createMovieMentorProductionBrowserOriginAuthority,
};

export default createMovieMentorProductionBrowserOriginAuthority;
