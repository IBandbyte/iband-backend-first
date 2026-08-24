/**
 * Movie Mentor Creator State Emergency Preservation
 * ------------------------------------------------------------
 * Deterministic fail-closed preservation/restoration contract for creator work.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to live autosave, local storage, databases or recovery services yet.
 * - NOT an AI agent.
 * - NO LIVE PERSISTENCE OR RESTORATION ADAPTERS.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const CONTROL_ID = "creator-state-emergency-preservation";
const AUTHORITY = "creator-state-preservation-contract-only";

const PRESERVATION_STATES = Object.freeze([
  "idle",
  "preservation-requested",
  "checkpoint-captured",
  "client-draft-captured",
  "multi-source-preserved",
  "preservation-partial",
  "preservation-failed",
  "restoration-review",
  "restoration-ready",
  "restoration-blocked",
  "restored",
  "restoration-verification-required",
]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function createPreservationRequest({
  preservationId = null,
  creatorSessionId = null,
  projectId = null,
  incidentId = null,
  requestedAt = null,
  reason = null,
  metadata = {},
} = {}) {
  return {
    controlId: CONTROL_ID,
    preservationId: cleanString(preservationId),
    creatorSessionId: cleanString(creatorSessionId) || null,
    projectId: cleanString(projectId) || null,
    incidentId: cleanString(incidentId) || null,
    requestedAt: cleanString(requestedAt) || null,
    reason: cleanString(reason) || null,
    authority: AUTHORITY,
    failClosed: true,
    metadata: cloneValue(metadata || {}),
  };
}

function validatePreservationRequest(request = {}) {
  const issues = [];
  if (request.controlId !== CONTROL_ID) issues.push("control_identity_invalid");
  if (request.authority !== AUTHORITY) issues.push("authority_invalid");
  if (request.failClosed !== true) issues.push("fail_closed_required");
  if (!cleanString(request.preservationId)) issues.push("preservation_id_required");
  if (!cleanString(request.creatorSessionId) && !cleanString(request.projectId)) issues.push("creator_session_or_project_reference_required");
  return { valid: issues.length === 0, issues };
}

function createStateEvidence({
  source = null,
  capturedAt = null,
  revision = null,
  checksum = null,
  contentReference = null,
  correlationId = null,
  metadata = {},
} = {}) {
  return {
    source: cleanString(source) || null,
    capturedAt: cleanString(capturedAt) || null,
    revision: cleanString(revision) || null,
    checksum: cleanString(checksum) || null,
    contentReference: cleanString(contentReference) || null,
    correlationId: cleanString(correlationId) || null,
    metadata: cloneValue(metadata || {}),
  };
}

function evaluatePreservationEvidence(request = {}, {
  serverCheckpointEvidence = [],
  clientDraftEvidence = [],
  correlationEvidence = [],
} = {}) {
  const preflight = validatePreservationRequest(request);
  if (!preflight.valid) return { preserved: false, state: "preservation-failed", issues: preflight.issues };

  const server = Array.isArray(serverCheckpointEvidence) ? serverCheckpointEvidence.filter(Boolean) : [];
  const client = Array.isArray(clientDraftEvidence) ? clientDraftEvidence.filter(Boolean) : [];
  const correlation = Array.isArray(correlationEvidence) ? correlationEvidence.filter(Boolean) : [];

  if (!server.length && !client.length) {
    return {
      preserved: false,
      state: "preservation-failed",
      issues: ["no_recoverable_state_evidence"],
      preservationId: request.preservationId,
    };
  }

  if (server.length && client.length) {
    return {
      preserved: true,
      state: "multi-source-preserved",
      preservationId: request.preservationId,
      serverCheckpointEvidence: cloneValue(server),
      clientDraftEvidence: cloneValue(client),
      correlationEvidence: cloneValue(correlation),
      restorationRequiresReview: true,
    };
  }

  return {
    preserved: true,
    state: "preservation-partial",
    preservationId: request.preservationId,
    serverCheckpointEvidence: cloneValue(server),
    clientDraftEvidence: cloneValue(client),
    correlationEvidence: cloneValue(correlation),
    restorationRequiresReview: true,
  };
}

function compareCandidateRevisions(a = {}, b = {}) {
  const aTime = Date.parse(a?.capturedAt || "");
  const bTime = Date.parse(b?.capturedAt || "");
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime > bTime ? 1 : -1;
  if (cleanString(a?.revision) && cleanString(b?.revision) && a.revision !== b.revision) return null;
  if (cleanString(a?.checksum) && cleanString(b?.checksum) && a.checksum === b.checksum) return 0;
  return null;
}

function evaluateRestorationCandidate({
  preservedState = null,
  currentServerState = null,
  candidateState = null,
  expectedProjectId = null,
  expectedCreatorSessionId = null,
} = {}) {
  const issues = [];
  if (!preservedState?.preserved) issues.push("preserved_state_required");
  if (!candidateState || typeof candidateState !== "object") issues.push("candidate_state_required");
  if (expectedProjectId && cleanString(candidateState?.projectId) && cleanString(candidateState.projectId) !== cleanString(expectedProjectId)) issues.push("project_scope_mismatch");
  if (expectedCreatorSessionId && cleanString(candidateState?.creatorSessionId) && cleanString(candidateState.creatorSessionId) !== cleanString(expectedCreatorSessionId)) issues.push("creator_session_scope_mismatch");

  if (issues.length) return { restorable: false, state: "restoration-blocked", issues };

  if (currentServerState && typeof currentServerState === "object") {
    const comparison = compareCandidateRevisions(candidateState, currentServerState);
    if (comparison === -1) {
      return { restorable: false, state: "restoration-blocked", issues: ["candidate_older_than_current_server_state"] };
    }
    if (comparison === null) {
      return { restorable: false, state: "restoration-review", issues: ["revision_order_not_safely_determinable"] };
    }
  }

  return {
    restorable: true,
    state: "restoration-ready",
    issues: [],
    candidateState: cloneValue(candidateState),
    verificationRequired: true,
  };
}

async function authoriseRestoration(restorationCandidate = {}, {
  restorationAuthorisation = null,
  verifyRestorationAuthorisation = null,
} = {}) {
  if (restorationCandidate?.restorable !== true || restorationCandidate?.state !== "restoration-ready") {
    return { authorised: false, state: "restoration-blocked", reasons: ["restoration_candidate_not_ready"] };
  }
  if (typeof verifyRestorationAuthorisation !== "function") {
    return { authorised: false, state: "restoration-blocked", reasons: ["trusted_restoration_authorisation_verifier_required"] };
  }

  const decision = await verifyRestorationAuthorisation({
    restorationAuthorisation: cloneValue(restorationAuthorisation),
    candidateState: cloneValue(restorationCandidate.candidateState),
  });

  if (decision?.authorised !== true) {
    return { authorised: false, state: "restoration-blocked", reasons: [cleanString(decision?.reason) || "restoration_not_authorised"] };
  }

  return {
    authorised: true,
    state: "restoration-verification-required",
    trustedAuthorisationReference: cleanString(decision?.reference) || null,
    candidateState: cloneValue(restorationCandidate.candidateState),
    verificationRequired: true,
  };
}

function getCreatorStateEmergencyPreservationManifest() {
  return {
    id: CONTROL_ID,
    name: "Movie Mentor Creator State Emergency Preservation",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-not-wired",
    authority: AUTHORITY,
    deterministicControl: true,
    aiAgent: false,
    failClosed: true,
    purpose: "Preserve recoverable creator state during incidents and prevent destructive restoration or stale overwrite without trusted evidence and authorisation.",
    capabilities: [
      "server-checkpoint-preservation-contract",
      "client-draft-preservation-contract",
      "multi-source-state-correlation",
      "stale-write-protection",
      "scope-mismatch-protection",
      "trusted-restoration-authorisation-gate",
      "mandatory-post-restoration-verification",
    ],
    restrictions: [
      "cannot-invent-missing-creator-work",
      "cannot-overwrite-newer-state",
      "cannot-bypass-project-or-session-scope",
      "cannot-bypass-privacy-or-access-controls",
      "cannot-restore-without-trusted-authorisation",
      "no-live-persistence-or-restoration-adapters",
    ],
  };
}

export {
  VERSION as CREATOR_STATE_EMERGENCY_PRESERVATION_VERSION,
  CONTRACT_VERSION as CREATOR_STATE_EMERGENCY_PRESERVATION_CONTRACT_VERSION,
  CONTROL_ID as CREATOR_STATE_EMERGENCY_PRESERVATION_CONTROL_ID,
  AUTHORITY as CREATOR_STATE_EMERGENCY_PRESERVATION_AUTHORITY,
  PRESERVATION_STATES,
  createPreservationRequest,
  validatePreservationRequest,
  createStateEvidence,
  evaluatePreservationEvidence,
  compareCandidateRevisions,
  evaluateRestorationCandidate,
  authoriseRestoration,
  getCreatorStateEmergencyPreservationManifest,
};

export default evaluatePreservationEvidence;
