// MovieMentorJourneyRecoveryRouteMountDependencyGate.js
// Version: 1.0.0
//
// 3C.5E.4A — Fail-Closed Route Mount Dependency Gate
//
// This module does not create authentication, verify credentials, create a
// recovery router, or mount a route. It only decides whether the dependencies
// required to construct and mount that router are explicitly present.
//
// Constitutional law:
//   Absence of authentication infrastructure is not permission to improvise
//   authentication infrastructure. It is a reason to keep the endpoint closed.

const DOMAIN = "iband.movie-mentor.journey-recovery-route-mount-dependency-gate";
const SCHEMA_VERSION = 1;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function closed(reason) {
  return freeze({
    mountable: false,
    mounted: false,
    reason,
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
  });
}

/**
 * Inspect recovery-route dependencies without invoking any of them.
 *
 * Important:
 * - A verifier must be an injected function. Strings, secrets, booleans and
 *   environment flags are not credential verification.
 * - Issuer and audience are explicit trust-policy configuration, not inferred
 *   from a request or request body.
 * - Router construction and mounting remain separate capabilities.
 * - This function never calls createRouter or mountRouter.
 */
export function inspectMovieMentorJourneyRecoveryRouteMountDependencies({
  verifyCredential = null,
  expectedIssuer = null,
  expectedAudience = null,
  createRouter = null,
  mountRouter = null,
} = {}) {
  if (typeof verifyCredential !== "function") {
    return closed("verifier-unavailable");
  }

  if (!text(expectedIssuer)) {
    return closed("issuer-unconfigured");
  }

  if (!text(expectedAudience)) {
    return closed("audience-unconfigured");
  }

  if (typeof createRouter !== "function") {
    return closed("router-factory-unavailable");
  }

  if (typeof mountRouter !== "function") {
    return closed("route-mounter-unavailable");
  }

  return freeze({
    mountable: true,
    mounted: false,
    reason: "dependencies-certified-present",
    expectedIssuer: text(expectedIssuer),
    expectedAudience: text(expectedAudience),
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
  });
}

/**
 * Mount only after the complete dependency set has passed inspection.
 *
 * The gate does not interpret request identity and does not call the verifier.
 * It passes the verifier and explicit trust policy to the injected certified
 * router factory, then gives the resulting router to the injected mounter.
 */
export function mountMovieMentorJourneyRecoveryRouteIfReady(options = {}) {
  const inspection =
    inspectMovieMentorJourneyRecoveryRouteMountDependencies(options);

  if (!inspection.mountable) {
    return inspection;
  }

  const router = options.createRouter({
    verifyCredential: options.verifyCredential,
    expectedIssuer: inspection.expectedIssuer,
    expectedAudience: inspection.expectedAudience,
  });

  if (!router) {
    return closed("router-factory-produced-no-router");
  }

  options.mountRouter(router);

  return freeze({
    mountable: true,
    mounted: true,
    reason: "mounted-with-explicit-authentication-dependencies",
    expectedIssuer: inspection.expectedIssuer,
    expectedAudience: inspection.expectedAudience,
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
  });
}

export const MOVIE_MENTOR_JOURNEY_RECOVERY_ROUTE_MOUNT_DEPENDENCY_GATE =
  freeze({
    domain: DOMAIN,
    schemaVersion: SCHEMA_VERSION,
    law:
      "No real verifier, explicit issuer, explicit audience, certified router factory, and explicit mounter means no recovery route mount.",
  });
