/**
 * Movie Mentor Operations State Machine
 * ------------------------------------------------------------
 * Deterministic fail-closed control-flow contract for future Operations wiring.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to live Movie Mentor runtime, deployment or infrastructure controls.
 * - NOT an AI agent.
 * - NO LIVE EXECUTION ADAPTERS.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const MACHINE_ID = "operations-state-machine";
const AUTHORITY = "operations-state-transition-contract-only";

const STATES = Object.freeze([
  "healthy",
  "watch",
  "degraded",
  "incident-detected",
  "diagnosing",
  "awaiting-recovery-authorisation",
  "recovery-authorised",
  "recovering",
  "verifying-recovery",
  "recovered",
  "awaiting-rollback-authorisation",
  "rollback-authorised",
  "rolling-back",
  "verifying-rollback",
  "quarantine-review",
  "quarantined",
  "awaiting-quarantine-release",
  "service-safe-mode",
  "external-outage-mode",
  "human-review-required",
]);

const MUTATING_TRANSITIONS = Object.freeze(new Set([
  "authorise-recovery",
  "begin-recovery",
  "authorise-rollback",
  "begin-rollback",
  "quarantine-agent",
  "release-quarantine",
]));

const TRANSITIONS = Object.freeze({
  healthy: Object.freeze({
    "observe-warning": "watch",
    "observe-degradation": "degraded",
    "detect-incident": "incident-detected",
    "detect-external-outage": "external-outage-mode",
  }),
  watch: Object.freeze({
    "clear-warning": "healthy",
    "observe-degradation": "degraded",
    "detect-incident": "incident-detected",
    "detect-external-outage": "external-outage-mode",
  }),
  degraded: Object.freeze({
    "restore-observed-health": "healthy",
    "detect-incident": "incident-detected",
    "enter-safe-mode": "service-safe-mode",
    "detect-external-outage": "external-outage-mode",
  }),
  "incident-detected": Object.freeze({
    "begin-diagnosis": "diagnosing",
    "enter-safe-mode": "service-safe-mode",
    "require-human-review": "human-review-required",
  }),
  diagnosing: Object.freeze({
    "request-recovery-authorisation": "awaiting-recovery-authorisation",
    "request-quarantine-review": "quarantine-review",
    "enter-safe-mode": "service-safe-mode",
    "require-human-review": "human-review-required",
  }),
  "awaiting-recovery-authorisation": Object.freeze({
    "authorise-recovery": "recovery-authorised",
    "deny-recovery": "human-review-required",
    "enter-safe-mode": "service-safe-mode",
  }),
  "recovery-authorised": Object.freeze({
    "begin-recovery": "recovering",
    "authorisation-expired": "awaiting-recovery-authorisation",
    "require-human-review": "human-review-required",
  }),
  recovering: Object.freeze({
    "recovery-execution-complete": "verifying-recovery",
    "recovery-execution-failed": "verifying-recovery",
  }),
  "verifying-recovery": Object.freeze({
    "verification-passed": "recovered",
    "verification-requires-rollback": "awaiting-rollback-authorisation",
    "verification-inconclusive": "human-review-required",
    "request-quarantine-review": "quarantine-review",
  }),
  recovered: Object.freeze({
    "sustained-health-confirmed": "healthy",
    "regression-observed": "incident-detected",
  }),
  "awaiting-rollback-authorisation": Object.freeze({
    "authorise-rollback": "rollback-authorised",
    "deny-rollback": "human-review-required",
    "enter-safe-mode": "service-safe-mode",
  }),
  "rollback-authorised": Object.freeze({
    "begin-rollback": "rolling-back",
    "authorisation-expired": "awaiting-rollback-authorisation",
    "require-human-review": "human-review-required",
  }),
  "rolling-back": Object.freeze({
    "rollback-execution-complete": "verifying-rollback",
    "rollback-execution-failed": "verifying-rollback",
  }),
  "verifying-rollback": Object.freeze({
    "verification-passed": "recovered",
    "verification-failed": "human-review-required",
    "request-quarantine-review": "quarantine-review",
  }),
  "quarantine-review": Object.freeze({
    "quarantine-agent": "quarantined",
    "quarantine-not-supported": "human-review-required",
  }),
  quarantined: Object.freeze({
    "request-quarantine-release": "awaiting-quarantine-release",
    "continue-safe-mode": "service-safe-mode",
  }),
  "awaiting-quarantine-release": Object.freeze({
    "release-quarantine": "diagnosing",
    "deny-release": "quarantined",
  }),
  "service-safe-mode": Object.freeze({
    "resume-diagnosis": "diagnosing",
    "detect-external-outage": "external-outage-mode",
    "require-human-review": "human-review-required",
  }),
  "external-outage-mode": Object.freeze({
    "external-health-restored": "incident-detected",
    "require-human-review": "human-review-required",
  }),
  "human-review-required": Object.freeze({
    "resume-diagnosis": "diagnosing",
    "enter-safe-mode": "service-safe-mode",
  }),
});

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function isKnownState(state) {
  return STATES.includes(cleanString(state));
}

function getTransitionTarget(fromState, event) {
  return TRANSITIONS?.[cleanString(fromState)]?.[cleanString(event)] || null;
}

function createOperationsState({ state = "healthy", incidentId = null, metadata = {} } = {}) {
  if (!isKnownState(state)) throw new Error(`Unknown Operations state: ${state}`);
  return {
    machineId: MACHINE_ID,
    state: cleanString(state),
    incidentId: cleanString(incidentId) || null,
    sequence: 0,
    authority: AUTHORITY,
    failClosed: true,
    metadata: cloneValue(metadata || {}),
  };
}

async function evaluateOperationsTransition(current = {}, event = null, {
  evidence = [],
  authorisation = null,
  verifyTransitionAuthorisation = null,
  emergencyPolicy = null,
  now = Date.now(),
} = {}) {
  const fromState = cleanString(current?.state);
  const eventId = cleanString(event);
  const auditBase = {
    machineId: MACHINE_ID,
    incidentId: cleanString(current?.incidentId) || null,
    fromState,
    event: eventId,
    evaluatedAt: new Date(now).toISOString(),
  };

  if (current?.machineId !== MACHINE_ID || current?.authority !== AUTHORITY || current?.failClosed !== true || !isKnownState(fromState)) {
    return { permitted: false, state: fromState || null, reason: "state_machine_contract_invalid", audit: auditBase };
  }

  const target = getTransitionTarget(fromState, eventId);
  if (!target) {
    return { permitted: false, state: fromState, reason: "transition_not_allowed", audit: auditBase };
  }

  if (!Array.isArray(evidence) || evidence.length === 0) {
    return { permitted: false, state: fromState, reason: "transition_evidence_required", audit: auditBase };
  }

  if (MUTATING_TRANSITIONS.has(eventId)) {
    if (typeof verifyTransitionAuthorisation !== "function") {
      return { permitted: false, state: fromState, reason: "trusted_transition_authorisation_verifier_required", audit: auditBase };
    }

    const trustedDecision = await verifyTransitionAuthorisation({
      machineId: MACHINE_ID,
      incidentId: cleanString(current?.incidentId) || null,
      fromState,
      event: eventId,
      toState: target,
      authorisation: cloneValue(authorisation),
      evidence: cloneValue(evidence),
      emergencyPolicy: cloneValue(emergencyPolicy),
    });

    if (trustedDecision?.authorised !== true) {
      return {
        permitted: false,
        state: fromState,
        reason: cleanString(trustedDecision?.reason) || "transition_not_authorised",
        audit: auditBase,
      };
    }
  }

  return {
    permitted: true,
    state: target,
    previousState: fromState,
    event: eventId,
    sequence: Number.isInteger(current?.sequence) ? current.sequence + 1 : 1,
    incidentId: cleanString(current?.incidentId) || null,
    authority: AUTHORITY,
    failClosed: true,
    evidence: cloneValue(evidence),
    audit: { ...auditBase, toState: target },
  };
}

function getOperationsStateMachineManifest() {
  return {
    id: MACHINE_ID,
    name: "Movie Mentor Operations State Machine",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-not-wired",
    purpose: "Deterministically govern allowed Operations control-flow transitions while keeping mutating recovery, rollback and quarantine authority outside AI reasoning.",
    authority: AUTHORITY,
    deterministicControl: true,
    aiAgent: false,
    failClosed: true,
    states: STATES,
    mutatingTransitions: [...MUTATING_TRANSITIONS],
    emergencyPrinciples: [
      "whole-app outage must be detectable from an external failure domain",
      "emergency automation must remain explicitly policy-bound",
      "no emergency policy may grant arbitrary code rewrite or deployment authority",
      "creator-state preservation and safe degradation remain separate runtime responsibilities",
      "outage communication must not assume a single user timezone",
    ],
    restrictions: [
      "no-live-runtime-or-infrastructure-adapters",
      "cannot-diagnose-by-itself",
      "cannot-create-authority",
      "cannot-self-approve-mutating-transitions",
      "cannot-deploy-or-rewrite-code",
      "cannot-bypass-independent-verification",
    ],
  };
}

export {
  VERSION as OPERATIONS_STATE_MACHINE_VERSION,
  CONTRACT_VERSION as OPERATIONS_STATE_MACHINE_CONTRACT_VERSION,
  MACHINE_ID as OPERATIONS_STATE_MACHINE_ID,
  AUTHORITY as OPERATIONS_STATE_MACHINE_AUTHORITY,
  STATES as OPERATIONS_STATES,
  MUTATING_TRANSITIONS as OPERATIONS_MUTATING_TRANSITIONS,
  TRANSITIONS as OPERATIONS_TRANSITIONS,
  createOperationsState,
  getTransitionTarget as getOperationsTransitionTarget,
  evaluateOperationsTransition,
  getOperationsStateMachineManifest,
};

export default evaluateOperationsTransition;
