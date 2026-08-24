/**
 * Movie Mentor Agent Admission + Quarantine Control
 * ------------------------------------------------------------
 * Deterministic fail-closed control boundary for future agent runtime admission.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to live runtime routing, deployment or process controls yet.
 * - NOT AI judgement.
 * - NO LIVE QUARANTINE / RELEASE ADAPTERS.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const CONTROL_ID = "agent-admission-quarantine-control";
const AUTHORITY = "operations-agent-admission-quarantine-control-contract-only";

const ADMISSION_STATES = Object.freeze([
  "admitted",
  "denied-unknown-identity",
  "denied-identity-mismatch",
  "denied-contract-mismatch",
  "denied-version-mismatch",
  "denied-disabled",
  "denied-quarantined",
  "denied-missing-trusted-identity",
  "release-review-required",
  "release-authorised",
  "release-denied",
]);

const DEFAULT_AGENT_REGISTRY = Object.freeze({});

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function getRegistryEntry(registry, runtimeAgentId) {
  const id = cleanString(runtimeAgentId);
  if (!id || !registry || typeof registry !== "object") return null;
  const entry = registry[id];
  return entry && typeof entry === "object" ? entry : null;
}

function createAgentAdmissionRequest({
  trustedRuntimeIdentity = null,
  claimedAgentIdentity = null,
  contractVersion = null,
  agentVersion = null,
  metadata = {},
} = {}) {
  return {
    controlId: CONTROL_ID,
    trustedRuntimeIdentity: cleanString(trustedRuntimeIdentity),
    claimedAgentIdentity: cleanString(claimedAgentIdentity),
    contractVersion: cleanString(contractVersion),
    agentVersion: cleanString(agentVersion),
    metadata: cloneValue(metadata || {}),
    authority: AUTHORITY,
    failClosed: true,
  };
}

function evaluateAgentAdmission(request = {}, {
  registry = DEFAULT_AGENT_REGISTRY,
  quarantineState = {},
} = {}) {
  const runtimeId = cleanString(request.trustedRuntimeIdentity);
  const claimedId = cleanString(request.claimedAgentIdentity);

  const audit = {
    controlId: CONTROL_ID,
    runtimeAgentId: runtimeId || null,
    claimedAgentId: claimedId || null,
    contractVersion: cleanString(request.contractVersion) || null,
    agentVersion: cleanString(request.agentVersion) || null,
    authority: AUTHORITY,
  };

  if (request.controlId !== CONTROL_ID || request.authority !== AUTHORITY || request.failClosed !== true) {
    return { admitted: false, state: "denied-unknown-identity", reasons: ["control_contract_invalid"], audit };
  }

  if (!runtimeId) {
    return { admitted: false, state: "denied-missing-trusted-identity", reasons: ["trusted_runtime_identity_required"], audit };
  }

  const entry = getRegistryEntry(registry, runtimeId);
  if (!entry) {
    return { admitted: false, state: "denied-unknown-identity", reasons: ["runtime_identity_not_registered"], audit };
  }

  if (claimedId && claimedId !== runtimeId) {
    return { admitted: false, state: "denied-identity-mismatch", reasons: ["claimed_identity_does_not_match_trusted_runtime_identity"], audit };
  }

  if (entry.enabled !== true) {
    return { admitted: false, state: "denied-disabled", reasons: ["registered_agent_not_enabled"], audit };
  }

  if (quarantineState?.[runtimeId]?.quarantined === true) {
    return {
      admitted: false,
      state: "denied-quarantined",
      reasons: ["agent_is_quarantined"],
      audit: { ...audit, quarantineReference: cleanString(quarantineState[runtimeId]?.reference) || null },
    };
  }

  const expectedContract = cleanString(entry.contractVersion);
  if (expectedContract && cleanString(request.contractVersion) !== expectedContract) {
    return { admitted: false, state: "denied-contract-mismatch", reasons: ["contract_version_mismatch"], audit };
  }

  const expectedVersion = cleanString(entry.agentVersion);
  if (expectedVersion && cleanString(request.agentVersion) !== expectedVersion) {
    return { admitted: false, state: "denied-version-mismatch", reasons: ["agent_version_mismatch"], audit };
  }

  return {
    admitted: true,
    state: "admitted",
    reasons: [],
    audit: {
      ...audit,
      registryIdentity: runtimeId,
      registeredAuthority: cleanString(entry.authority) || null,
    },
  };
}

function createQuarantineRecord({
  trustedRuntimeIdentity = null,
  reference = null,
  reasons = [],
  authorisedBy = null,
  authorisedAt = null,
  metadata = {},
} = {}) {
  const runtimeId = cleanString(trustedRuntimeIdentity);
  if (!runtimeId) throw new Error("Trusted runtime identity is required for quarantine.");
  if (!cleanString(reference)) throw new Error("Quarantine reference is required.");

  return {
    runtimeAgentId: runtimeId,
    quarantined: true,
    reference: cleanString(reference),
    reasons: Array.isArray(reasons) ? cloneValue(reasons) : [],
    authorisedBy: cleanString(authorisedBy) || null,
    authorisedAt: cleanString(authorisedAt) || null,
    metadata: cloneValue(metadata || {}),
  };
}

async function evaluateQuarantineRelease({
  trustedRuntimeIdentity = null,
  quarantineRecord = null,
  repairEvidence = [],
  verificationEvidence = [],
  releaseAuthorisation = null,
} = {}, {
  verifyReleaseAuthorisation = null,
} = {}) {
  const runtimeId = cleanString(trustedRuntimeIdentity);

  if (!runtimeId || quarantineRecord?.quarantined !== true || cleanString(quarantineRecord?.runtimeAgentId) !== runtimeId) {
    return { released: false, state: "release-denied", reasons: ["valid_quarantine_record_required"] };
  }

  if (!Array.isArray(repairEvidence) || repairEvidence.length === 0) {
    return { released: false, state: "release-review-required", reasons: ["repair_evidence_required"] };
  }

  if (!Array.isArray(verificationEvidence) || verificationEvidence.length === 0) {
    return { released: false, state: "release-review-required", reasons: ["independent_verification_evidence_required"] };
  }

  if (typeof verifyReleaseAuthorisation !== "function") {
    return { released: false, state: "release-denied", reasons: ["trusted_release_authorisation_verifier_required"] };
  }

  const trustedDecision = await verifyReleaseAuthorisation({
    runtimeAgentId: runtimeId,
    quarantineReference: cleanString(quarantineRecord.reference),
    releaseAuthorisation: cloneValue(releaseAuthorisation),
    repairEvidence: cloneValue(repairEvidence),
    verificationEvidence: cloneValue(verificationEvidence),
  });

  if (trustedDecision?.authorised !== true) {
    return {
      released: false,
      state: "release-denied",
      reasons: [cleanString(trustedDecision?.reason) || "release_not_authorised"],
    };
  }

  return {
    released: true,
    state: "release-authorised",
    reasons: [],
    audit: {
      controlId: CONTROL_ID,
      runtimeAgentId: runtimeId,
      quarantineReference: cleanString(quarantineRecord.reference),
      trustedAuthorisationReference: cleanString(trustedDecision?.reference) || null,
      verificationRequiredBeforeAdmission: true,
    },
  };
}

function getAgentAdmissionQuarantineControlManifest() {
  return {
    id: CONTROL_ID,
    name: "Movie Mentor Agent Admission + Quarantine Control",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-no-live-adapters",
    purpose: "Fail closed on unknown, mismatched, disabled or quarantined agents and require trusted external authorisation plus repair/verification evidence before quarantine release.",
    authority: AUTHORITY,
    deterministicControl: true,
    aiJudgement: false,
    failClosed: true,
    defaultRegistrySize: Object.keys(DEFAULT_AGENT_REGISTRY).length,
    capabilities: [
      "trusted-runtime-identity-admission",
      "explicit-registry-enforcement",
      "identity-mismatch-rejection",
      "contract-version-enforcement",
      "agent-version-enforcement",
      "quarantine-enforcement",
      "trusted-release-authorisation-gate",
    ],
    restrictions: [
      "no-ai-self-admission",
      "no-agent-self-release",
      "no-default-registered-agents",
      "no-live-runtime-or-deployment-adapters",
      "cannot-repair-rewrite-or-deploy-agents",
    ],
  };
}

export {
  VERSION as AGENT_ADMISSION_QUARANTINE_CONTROL_VERSION,
  CONTRACT_VERSION as AGENT_ADMISSION_QUARANTINE_CONTROL_CONTRACT_VERSION,
  CONTROL_ID as AGENT_ADMISSION_QUARANTINE_CONTROL_ID,
  AUTHORITY as AGENT_ADMISSION_QUARANTINE_CONTROL_AUTHORITY,
  ADMISSION_STATES,
  DEFAULT_AGENT_REGISTRY,
  createAgentAdmissionRequest,
  evaluateAgentAdmission,
  createQuarantineRecord,
  evaluateQuarantineRelease,
  getAgentAdmissionQuarantineControlManifest,
};

export default evaluateAgentAdmission;
