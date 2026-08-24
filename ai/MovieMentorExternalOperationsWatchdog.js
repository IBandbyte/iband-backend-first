/**
 * Movie Mentor External Operations Watchdog + Status Control Plane
 * ----------------------------------------------------------------
 * Deterministic contract intended for a future deployment OUTSIDE the
 * Movie Mentor application failure domain.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to monitoring, DNS/CDN, status page, deployment or paging.
 * - NOT an AI agent.
 * - NO LIVE EMERGENCY ACTION ADAPTERS.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const CONTROL_ID = "external-operations-watchdog";
const AUTHORITY = "external-operations-watchdog-contract-only";

const HEALTH_STATES = Object.freeze([
  "unknown",
  "healthy",
  "suspected-degradation",
  "confirmed-degradation",
  "suspected-outage",
  "confirmed-outage",
  "recovery-observed",
  "stability-verification",
]);

const DEFAULT_PUBLIC_MESSAGES = Object.freeze({
  "suspected-degradation": "Movie Mentor is experiencing a temporary service issue. Some features may be unavailable or slower than normal. We apologise for the inconvenience.",
  "confirmed-degradation": "Movie Mentor is experiencing a temporary service issue. Some features may be unavailable or slower than normal. Operations are working to restore normal service.",
  "suspected-outage": "Movie Mentor is temporarily unavailable. Operations are investigating and working to restore service. We apologise for the inconvenience.",
  "confirmed-outage": "Movie Mentor is temporarily unavailable while Operations restore our systems. Service will resume as soon as it is safely available. We apologise for the inconvenience.",
  "recovery-observed": "Movie Mentor service is being restored. Operations are verifying stability before normal service is confirmed.",
  "stability-verification": "Movie Mentor service has been restored and Operations are verifying continued stability.",
  healthy: "Movie Mentor is operating normally.",
  unknown: "Movie Mentor service status is currently being verified.",
});

const DEFAULT_EMERGENCY_ACTION_ALLOWLIST = Object.freeze([]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function createExternalHealthObservation({
  observationId = null,
  observedAt = null,
  probeSource = null,
  target = null,
  reachable = null,
  statusCode = null,
  latencyMs = null,
  evidence = [],
  metadata = {},
} = {}) {
  return {
    observationId: cleanString(observationId) || null,
    observedAt: cleanString(observedAt) || null,
    probeSource: cleanString(probeSource) || null,
    target: cleanString(target) || null,
    reachable: typeof reachable === "boolean" ? reachable : null,
    statusCode: Number.isInteger(statusCode) ? statusCode : null,
    latencyMs: Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : null,
    evidence: Array.isArray(evidence) ? cloneValue(evidence) : [],
    metadata: cloneValue(metadata || {}),
  };
}

function evaluateExternalHealth(observations = [], {
  minimumIndependentFailures = 2,
  minimumIndependentSuccesses = 2,
} = {}) {
  const valid = Array.isArray(observations) ? observations.filter(Boolean) : [];
  const failures = valid.filter(x => x?.reachable === false || (Number.isInteger(x?.statusCode) && x.statusCode >= 500));
  const successes = valid.filter(x => x?.reachable === true && (!Number.isInteger(x?.statusCode) || x.statusCode < 500));
  const failureSources = new Set(failures.map(x => cleanString(x?.probeSource)).filter(Boolean));
  const successSources = new Set(successes.map(x => cleanString(x?.probeSource)).filter(Boolean));

  if (!valid.length) return { state: "unknown", confidence: "insufficient-evidence", failures: 0, successes: 0 };
  if (failureSources.size >= minimumIndependentFailures) return { state: "confirmed-outage", confidence: "multi-source", failures: failures.length, successes: successes.length };
  if (failures.length) return { state: "suspected-outage", confidence: "single-or-insufficient-source", failures: failures.length, successes: successes.length };
  if (successSources.size >= minimumIndependentSuccesses) return { state: "healthy", confidence: "multi-source", failures: 0, successes: successes.length };
  return { state: "unknown", confidence: "insufficient-evidence", failures: 0, successes: successes.length };
}

function createExternalIncident({ incidentId, healthState, observations = [], detectedAt = null, metadata = {} } = {}) {
  const id = cleanString(incidentId);
  if (!id) throw new Error("External incidentId is required.");
  if (!HEALTH_STATES.includes(cleanString(healthState))) throw new Error("Known external healthState is required.");
  return {
    controlId: CONTROL_ID,
    incidentId: id,
    healthState: cleanString(healthState),
    detectedAt: cleanString(detectedAt) || null,
    observations: cloneValue(Array.isArray(observations) ? observations : []),
    authority: AUTHORITY,
    externalFailureDomainRequired: true,
    metadata: cloneValue(metadata || {}),
  };
}

function getPublicStatusMessage(healthState, { customMessage = null } = {}) {
  const state = cleanString(healthState);
  const custom = cleanString(customMessage);
  return {
    state: HEALTH_STATES.includes(state) ? state : "unknown",
    message: custom || DEFAULT_PUBLIC_MESSAGES[state] || DEFAULT_PUBLIC_MESSAGES.unknown,
    timezoneNeutral: true,
    restorationTimePromised: false,
  };
}

async function evaluateEmergencyAction({
  incident = null,
  actionId = null,
  targetScope = null,
  evidence = [],
  authorisation = null,
} = {}, {
  allowedActionIds = DEFAULT_EMERGENCY_ACTION_ALLOWLIST,
  verifyEmergencyAuthorisation = null,
} = {}) {
  const action = cleanString(actionId);
  const reasons = [];

  if (incident?.controlId !== CONTROL_ID || incident?.authority !== AUTHORITY || incident?.externalFailureDomainRequired !== true) reasons.push("external_incident_contract_invalid");
  if (!action) reasons.push("action_id_required");
  if (!Array.isArray(allowedActionIds) || !allowedActionIds.includes(action)) reasons.push("action_not_emergency_allowlisted");
  if (!Array.isArray(evidence) || evidence.length === 0) reasons.push("emergency_evidence_required");
  if (typeof verifyEmergencyAuthorisation !== "function") reasons.push("trusted_emergency_authorisation_verifier_required");

  if (reasons.length) return { permitted: false, actionId: action || null, reasons };

  const decision = await verifyEmergencyAuthorisation({
    incidentId: cleanString(incident.incidentId),
    healthState: cleanString(incident.healthState),
    actionId: action,
    targetScope: cloneValue(targetScope),
    evidence: cloneValue(evidence),
    authorisation: cloneValue(authorisation),
  });

  if (decision?.authorised !== true) {
    return { permitted: false, actionId: action, reasons: [cleanString(decision?.reason) || "emergency_action_not_authorised"] };
  }

  return {
    permitted: true,
    actionId: action,
    targetScope: cloneValue(targetScope),
    trustedAuthorisationReference: cleanString(decision?.reference) || null,
    verificationRequired: true,
  };
}

function createCreatorStateProtectionSignal({ incidentId = null, detectedAt = null } = {}) {
  return {
    incidentId: cleanString(incidentId) || null,
    detectedAt: cleanString(detectedAt) || null,
    requestedProtections: [
      "preserve-latest-server-checkpoint-if-reachable",
      "preserve-client-side-draft-if-supported",
      "prevent-destructive-retry-loops",
      "retain-recovery-correlation-identifiers",
    ],
    advisoryOnly: true,
    note: "Actual creator-state persistence belongs to a separately verified runtime persistence layer.",
  };
}

function getExternalOperationsWatchdogManifest() {
  return {
    id: CONTROL_ID,
    name: "Movie Mentor External Operations Watchdog + Status Control Plane",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-not-wired",
    authority: AUTHORITY,
    deterministicControl: true,
    aiAgent: false,
    intendedDeploymentBoundary: "outside-movie-mentor-primary-application-failure-domain",
    defaultEmergencyActionAllowlistSize: DEFAULT_EMERGENCY_ACTION_ALLOWLIST.length,
    capabilities: [
      "independent-external-health-observation",
      "multi-source-outage-confirmation",
      "timezone-neutral-public-status-messaging",
      "policy-bound-emergency-action-gating",
      "creator-state-protection-signalling",
    ],
    restrictions: [
      "cannot-diagnose-with-ai-by-itself",
      "cannot-invent-restoration-times",
      "cannot-assume-user-local-timezone",
      "cannot-rewrite-or-deploy-arbitrary-code",
      "cannot-create-emergency-authority",
      "no-default-emergency-actions",
      "no-live-monitoring-status-page-or-infrastructure-adapters",
    ],
  };
}

export {
  VERSION as EXTERNAL_OPERATIONS_WATCHDOG_VERSION,
  CONTRACT_VERSION as EXTERNAL_OPERATIONS_WATCHDOG_CONTRACT_VERSION,
  CONTROL_ID as EXTERNAL_OPERATIONS_WATCHDOG_CONTROL_ID,
  AUTHORITY as EXTERNAL_OPERATIONS_WATCHDOG_AUTHORITY,
  HEALTH_STATES as EXTERNAL_OPERATIONS_HEALTH_STATES,
  DEFAULT_PUBLIC_MESSAGES as EXTERNAL_OPERATIONS_DEFAULT_PUBLIC_MESSAGES,
  DEFAULT_EMERGENCY_ACTION_ALLOWLIST,
  createExternalHealthObservation,
  evaluateExternalHealth,
  createExternalIncident,
  getPublicStatusMessage,
  evaluateEmergencyAction,
  createCreatorStateProtectionSignal,
  getExternalOperationsWatchdogManifest,
};

export default evaluateExternalHealth;
