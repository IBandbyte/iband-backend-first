/**
 * Movie Mentor Operations Control Plane
 * -------------------------------------
 * Final deterministic integration boundary for Operations architecture.
 *
 * STATUS:
 * - Standalone / dormant.
 * - NOT an AI agent.
 * - NO live runtime, DB, deployment, quarantine or infrastructure adapters.
 * - All mutating persistence is delegated to trusted external transaction adapters.
 */

import {
  getCanonicalAgent,
  validateCanonicalRuntimeIdentity,
} from "./MovieMentorCanonicalAgentRegistry.js";
import {
  createAgentAdmissionRequest,
  evaluateAgentAdmission,
  createQuarantineRecord,
} from "./MovieMentorAgentAdmissionQuarantineControl.js";
import {
  evaluateOperationsTransition,
} from "./MovieMentorOperationsStateMachine.js";
import {
  appendIncidentEvent,
  verifyIncidentLedger,
} from "./MovieMentorOperationsAuditIncidentLedger.js";

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const CONTROL_ID = "operations-control-plane";
const AUTHORITY = "operations-control-plane-contract-only";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableJson(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sameScope(a, b) {
  return JSON.stringify(stableJson(a ?? null)) === JSON.stringify(stableJson(b ?? null));
}

function resolveCanonicalAgentManifest(agentId, manifest = null) {
  const canonical = getCanonicalAgent(agentId);
  const issues = [];
  if (!canonical) return { valid: false, issues: ["canonical_agent_unknown"], entry: null };
  if (!manifest || typeof manifest !== "object") issues.push("trusted_module_manifest_required");

  const manifestId = cleanString(manifest?.id);
  const manifestVersion = cleanString(manifest?.version);
  const manifestContractVersion = cleanString(manifest?.contractVersion);
  const manifestAuthority = cleanString(manifest?.authority);

  if (manifestId !== canonical.agentId) issues.push("manifest_identity_mismatch");
  if (!manifestVersion) issues.push("manifest_version_required");
  if (!manifestContractVersion) issues.push("manifest_contract_version_required");
  if (manifestAuthority !== canonical.authority) issues.push("manifest_authority_mismatch");
  if (manifest?.creatorFacing !== false) issues.push("manifest_creator_facing_contract_invalid");
  if (manifest?.readOnly !== true) issues.push("manifest_read_only_contract_invalid");

  if (issues.length) return { valid: false, issues, entry: null };

  return {
    valid: true,
    issues: [],
    entry: {
      agentId: canonical.agentId,
      trustedRuntimeIdentity: canonical.trustedRuntimeIdentity,
      modulePath: canonical.modulePath,
      department: canonical.department,
      authority: canonical.authority,
      enabled: canonical.enabled === true,
      creatorFacing: false,
      readOnly: true,
      agentVersion: manifestVersion,
      contractVersion: manifestContractVersion,
      manifestResolved: true,
    },
  };
}

function createResolvedAdmissionRegistry(manifestsByAgentId = {}) {
  const registry = {};
  const issues = [];
  if (!manifestsByAgentId || typeof manifestsByAgentId !== "object") {
    return { valid: false, issues: ["manifest_map_required"], registry: {} };
  }

  for (const [agentId, manifest] of Object.entries(manifestsByAgentId)) {
    const resolved = resolveCanonicalAgentManifest(agentId, manifest);
    if (!resolved.valid) {
      issues.push(...resolved.issues.map(issue => `${agentId}:${issue}`));
      continue;
    }
    registry[resolved.entry.trustedRuntimeIdentity] = resolved.entry;
  }

  return { valid: issues.length === 0, issues, registry };
}

function admitRuntimeSpecialist({
  trustedRuntimeIdentity,
  claimedAgentIdentity,
  manifest,
  quarantineState = {},
} = {}) {
  const identity = validateCanonicalRuntimeIdentity({ trustedRuntimeIdentity, claimedAgentIdentity });
  if (!identity.valid) return { admitted: false, state: "denied-identity", reasons: identity.reasons };

  const resolved = resolveCanonicalAgentManifest(trustedRuntimeIdentity, manifest);
  if (!resolved.valid) return { admitted: false, state: "denied-manifest", reasons: resolved.issues };

  const registry = { [trustedRuntimeIdentity]: resolved.entry };
  const request = createAgentAdmissionRequest({
    trustedRuntimeIdentity,
    claimedAgentIdentity,
    contractVersion: resolved.entry.contractVersion,
    agentVersion: resolved.entry.agentVersion,
  });
  const decision = evaluateAgentAdmission(request, { registry, quarantineState });
  if (!decision.admitted) return decision;

  return {
    admitted: true,
    state: "admitted",
    reasons: [],
    admissionEvidence: {
      controlPlaneId: CONTROL_ID,
      runtimeAgentId: trustedRuntimeIdentity,
      canonicalAgentId: resolved.entry.agentId,
      authority: resolved.entry.authority,
      agentVersion: resolved.entry.agentVersion,
      contractVersion: resolved.entry.contractVersion,
      creatorFacing: false,
      readOnly: true,
      manifestResolved: true,
      admissionState: "admitted",
    },
  };
}

function bindContributionToAdmission(contribution = {}, admissionEvidence = null) {
  const agentId = cleanString(contribution?.agentId);
  const runtimeAgentId = cleanString(admissionEvidence?.runtimeAgentId);
  const issues = [];
  if (!agentId) issues.push("contribution_agent_identity_required");
  if (admissionEvidence?.controlPlaneId !== CONTROL_ID) issues.push("control_plane_admission_evidence_required");
  if (admissionEvidence?.admissionState !== "admitted") issues.push("specialist_not_admitted");
  if (!runtimeAgentId || runtimeAgentId !== agentId) issues.push("admission_contribution_identity_mismatch");
  if (admissionEvidence?.creatorFacing !== false) issues.push("admission_creator_facing_contract_invalid");
  if (admissionEvidence?.readOnly !== true) issues.push("admission_read_only_contract_invalid");
  if (admissionEvidence?.manifestResolved !== true) issues.push("manifest_resolution_required");
  if (issues.length) return { valid: false, issues, contribution: null };
  return {
    valid: true,
    issues: [],
    contribution: {
      ...cloneValue(contribution),
      runtimeAdmission: cloneValue(admissionEvidence),
    },
  };
}

async function commitTransitionWithAudit({
  currentState,
  event,
  transitionOptions = {},
  incidentLedger,
  actorRuntimeIdentity = null,
  summary = null,
} = {}, {
  atomicCommit = null,
} = {}) {
  if (typeof atomicCommit !== "function") {
    return { committed: false, reason: "trusted_atomic_transition_commit_required" };
  }

  const ledgerIntegrity = verifyIncidentLedger(incidentLedger);
  if (!ledgerIntegrity.valid) return { committed: false, reason: "incident_ledger_integrity_invalid", issues: ledgerIntegrity.issues };
  if (cleanString(currentState?.incidentId) !== cleanString(incidentLedger?.incidentId)) {
    return { committed: false, reason: "state_ledger_incident_mismatch" };
  }

  const transition = await evaluateOperationsTransition(currentState, event, transitionOptions);
  const eventType = transition.permitted ? "state-transition-permitted" : "state-transition-denied";
  const nextLedger = appendIncidentEvent(incidentLedger, {
    eventType,
    occurredAt: transition?.audit?.evaluatedAt || null,
    actorRuntimeIdentity,
    source: CONTROL_ID,
    summary,
    evidence: transitionOptions?.evidence || [],
    references: {
      fromState: transition?.audit?.fromState || currentState?.state || null,
      toState: transition?.audit?.toState || null,
      event: cleanString(event) || null,
      stateSequence: transition?.sequence ?? currentState?.sequence ?? null,
    },
    decision: {
      permitted: transition.permitted === true,
      reason: transition.reason || null,
    },
  });

  const commit = await atomicCommit({
    incidentId: currentState.incidentId,
    expectedStateSequence: currentState.sequence,
    expectedLedgerHeadHash: incidentLedger.headHash,
    nextState: transition.permitted ? cloneValue(transition) : cloneValue(currentState),
    nextLedger: cloneValue(nextLedger),
    transition: cloneValue(transition),
  });

  if (commit?.committed !== true) {
    return { committed: false, reason: cleanString(commit?.reason) || "atomic_transition_commit_failed", transition };
  }

  return {
    committed: true,
    transition,
    state: transition.permitted ? transition : currentState,
    ledger: nextLedger,
    commitReference: cleanString(commit?.reference) || null,
  };
}

function createAuthoritativeQuarantineRecord({
  transition,
  trustedRuntimeIdentity,
  reference,
  reasons = [],
  authorisedBy = null,
  authorisedAt = null,
  metadata = {},
} = {}) {
  const issues = [];
  if (transition?.permitted !== true) issues.push("permitted_quarantine_transition_required");
  if (transition?.event !== "quarantine-agent") issues.push("quarantine_transition_event_required");
  if (transition?.state !== "quarantined") issues.push("quarantined_terminal_state_required");
  if (!cleanString(transition?.incidentId)) issues.push("incident_id_required");
  if (issues.length) return { valid: false, issues, record: null };

  const record = createQuarantineRecord({
    trustedRuntimeIdentity,
    reference,
    reasons,
    authorisedBy,
    authorisedAt,
    metadata: {
      ...cloneValue(metadata || {}),
      incidentId: transition.incidentId,
      stateSequence: transition.sequence,
      transitionEvent: transition.event,
      authoritative: true,
    },
  });
  return { valid: true, issues: [], record };
}

function evaluateIncidentClosure({ currentState, incidentLedger } = {}) {
  const reasons = [];
  const ledgerIntegrity = verifyIncidentLedger(incidentLedger);
  if (!ledgerIntegrity.valid) reasons.push("incident_ledger_integrity_invalid");
  if (cleanString(currentState?.incidentId) !== cleanString(incidentLedger?.incidentId)) reasons.push("state_ledger_incident_mismatch");
  if (currentState?.state !== "healthy") reasons.push("verified_healthy_terminal_state_required");
  const entries = Array.isArray(incidentLedger?.entries) ? incidentLedger.entries : [];
  const hasVerification = entries.some(entry => ["recovery-verification-recorded", "rollback-verification-recorded"].includes(entry?.eventType));
  const hasPermittedTransition = entries.some(entry => entry?.eventType === "state-transition-permitted" && entry?.references?.toState === "healthy");
  if (!hasVerification) reasons.push("independent_recovery_or_rollback_verification_record_required");
  if (!hasPermittedTransition) reasons.push("healthy_transition_ledger_evidence_required");
  return { closable: reasons.length === 0, reasons };
}

function closeIncidentWithEvidence({ currentState, incidentLedger, occurredAt = null, summary = null } = {}) {
  const closure = evaluateIncidentClosure({ currentState, incidentLedger });
  if (!closure.closable) return { closed: false, reasons: closure.reasons, ledger: incidentLedger };
  const ledger = appendIncidentEvent(incidentLedger, {
    eventType: "incident-closed",
    occurredAt,
    source: CONTROL_ID,
    summary,
    references: {
      finalState: currentState.state,
      finalStateSequence: currentState.sequence,
    },
    decision: { closed: true },
  });
  return { closed: true, reasons: [], ledger };
}

function validateVerificationScope({ expectedIncidentId, actualIncidentId, expectedScope, actualScope } = {}) {
  const reasons = [];
  if (!cleanString(expectedIncidentId) || cleanString(expectedIncidentId) !== cleanString(actualIncidentId)) reasons.push("verification_incident_mismatch");
  if (!sameScope(expectedScope, actualScope)) reasons.push("verification_scope_mismatch");
  return { valid: reasons.length === 0, reasons };
}

function getOperationsControlPlaneManifest() {
  return {
    id: CONTROL_ID,
    name: "Movie Mentor Operations Control Plane",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-not-wired",
    authority: AUTHORITY,
    deterministicControl: true,
    aiAgent: false,
    capabilities: [
      "canonical-manifest-resolution",
      "runtime-admission-binding",
      "supervisor-contribution-admission-evidence",
      "atomic-state-transition-and-ledger-commit-contract",
      "authorised-quarantine-binding",
      "verified-incident-closure-gating",
      "verification-scope-correlation",
    ],
    restrictions: [
      "cannot-create-agent-authority",
      "cannot-self-authorise-mutating-transitions",
      "cannot-trust-agent-self-identity",
      "cannot-duplicate-module-version-truth",
      "cannot-close-unverified-incidents",
      "no-live-runtime-database-or-infrastructure-adapters",
    ],
  };
}

export {
  VERSION as OPERATIONS_CONTROL_PLANE_VERSION,
  CONTRACT_VERSION as OPERATIONS_CONTROL_PLANE_CONTRACT_VERSION,
  CONTROL_ID as OPERATIONS_CONTROL_PLANE_ID,
  AUTHORITY as OPERATIONS_CONTROL_PLANE_AUTHORITY,
  resolveCanonicalAgentManifest,
  createResolvedAdmissionRegistry,
  admitRuntimeSpecialist,
  bindContributionToAdmission,
  commitTransitionWithAudit,
  createAuthoritativeQuarantineRecord,
  evaluateIncidentClosure,
  closeIncidentWithEvidence,
  validateVerificationScope,
  getOperationsControlPlaneManifest,
};

export default admitRuntimeSpecialist;
