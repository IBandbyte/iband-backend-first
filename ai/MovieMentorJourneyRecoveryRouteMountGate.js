const MOVIE_MENTOR_JOURNEY_RECOVERY_ROUTE_MOUNT_GATE_VERSION = "1.0.0";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function inspectMovieMentorJourneyRecoveryRouteMount({
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  createRouter = null,
} = {}) {
  const issuer = cleanString(expectedIssuer);
  const audience = cleanString(expectedAudience);
  const reasons = [];

  if (typeof verifyCredential !== "function") reasons.push("external-verifier-unavailable");
  if (!issuer) reasons.push("expected-issuer-unconfigured");
  if (!audience) reasons.push("expected-audience-unconfigured");
  if (typeof createRouter !== "function") reasons.push("http-router-factory-unavailable");

  return Object.freeze({
    version: MOVIE_MENTOR_JOURNEY_RECOVERY_ROUTE_MOUNT_GATE_VERSION,
    mountable: reasons.length === 0,
    reasons: Object.freeze(reasons),
    issuerConfigured: Boolean(issuer),
    audienceConfigured: Boolean(audience),
    externalVerifierAvailable: typeof verifyCredential === "function",
    routerFactoryAvailable: typeof createRouter === "function",
  });
}

async function mountMovieMentorJourneyRecoveryRoute({
  app = null,
  basePath = "/api/movie-mentor/recovery",
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  createRouter = null,
} = {}) {
  const inspection = inspectMovieMentorJourneyRecoveryRouteMount({
    verifyCredential,
    expectedIssuer,
    expectedAudience,
    createRouter,
  });

  if (!inspection.mountable) {
    return Object.freeze({ status: "not-mounted", ...inspection });
  }

  if (typeof app?.use !== "function") {
    const error = new Error("Journey recovery route mount requires an Express-compatible app.use function.");
    error.code = "MOVIE_MENTOR_JOURNEY_RECOVERY_ROUTE_APP_REQUIRED";
    throw error;
  }

  const router = await createRouter({
    verifyCredential,
    expectedIssuer: cleanString(expectedIssuer),
    expectedAudience: cleanString(expectedAudience),
  });

  if (!router) {
    const error = new Error("Journey recovery route factory did not return a router.");
    error.code = "MOVIE_MENTOR_JOURNEY_RECOVERY_ROUTE_FACTORY_INVALID";
    throw error;
  }

  const path = cleanString(basePath) || "/api/movie-mentor/recovery";
  app.use(path, router);

  return Object.freeze({
    status: "mounted",
    path,
    ...inspection,
  });
}

export {
  MOVIE_MENTOR_JOURNEY_RECOVERY_ROUTE_MOUNT_GATE_VERSION,
  inspectMovieMentorJourneyRecoveryRouteMount,
  mountMovieMentorJourneyRecoveryRoute,
};

export default mountMovieMentorJourneyRecoveryRoute;
