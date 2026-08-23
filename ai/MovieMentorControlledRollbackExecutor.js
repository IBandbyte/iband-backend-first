/**
 * Movie Mentor Controlled Rollback Executor
 * ------------------------------------------------------------
 * Fail-closed execution contract for future authorised Operations rollback.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to production systems, providers, data stores or infrastructure.
 * - NOT creator-facing.
 * - NO LIVE ROLLBACK ADAPTERS.
 * - NO AUTONOMOUS AUTHORITY.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const EXECUTOR_ID = "controlled-rollback-executor";
const AUTHORITY = "operations-approved-rollback-execution-contract-only";

const EXECUTION_STATES = Object.freeze([
  "approved-intent-ready",
  "denied",
  "expired-authorisation",
  "scope-mismatch",
  "action-not-allowlisted",
  "approval-missing",
  "approval-invalid",
  "duplicate-request",
  "adapter-unavailable",
  "execution-succeeded",
  "execution-failed",
]);

const DEFAULT_ALLOWLIST = Object.freeze([]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

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

function parseTime(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeAllowlist(allowlist = DEFAULT_ALLOWLIST) {
  return new Set(asArray(allowlist).map(cleanString).filter(Boolean));
}

function createControlledRollbackRequest({
  actionId = null,
  requestId = null,
  recoveryExecutionId = null,
  verificationReference = null,
  scope = null,
  parameters = {},
  authorisation = null,
  requestedBy = null,
  metadata = {},
} = {}) {
  return {
    executorId: EXECUTOR_ID,
    actionId: cleanString(actionId),
    requestId: cleanString(requestId),
    recoveryExecutionId: cleanString(recoveryExecutionId),
    verificationReference: cleanString(verificationReference),
    scope: cloneValue(scope),
    parameters: cloneValue(parameters || {}),
    authorisation: cloneValue(authorisation),
    requestedBy: cleanString(requestedBy),
    metadata: cloneValue(metadata || {}),
    authority: AUTHORITY,
    creatorFacing: false,
    failClosed: true,
  };
}

function validateAuthorisation(request = {}, { now = Date.now() } = {}) {
  const approval = request?.authorisation;
  if (!approval || typeof approval !== "object") {
    return { valid: false, state: "approval-missing", issues: ["rollback_authorisation_missing"] };
  }

  const issues = [];
  if (approval.approved !== true) issues.push("rollback_not_explicitly_approved");
  if (!cleanString(approval.approvalId)) issues.push("approval_id_missing");
  if (!cleanString(approval.approvedBy)) issues.push("approved_by_missing");
  if (cleanString(approval.actionId) !== cleanString(request.actionId)) issues.push("approval_action_mismatch");

  const expiresAt = parseTime(approval.expiresAt);
  if (expiresAt === null) issues.push("approval_expiry_missing_or_invalid");
  if (expiresAt !== null && expiresAt <= now) {
    return { valid: false, state: "expired-authorisation", issues: ["rollback_authorisation_expired"] };
  }

  const approvedScope = JSON.stringify(approval.scope ?? null);
  const requestedScope = JSON.stringify(request.scope ?? null);
  if (approvedScope !== requestedScope) {
    return { valid: false, state: "scope-mismatch", issues: ["rollback_scope_mismatch"] };
  }

  if (issues.length > 0) return { valid: false, state: "approval-invalid", issues };
  return { valid: true, state: "approved-intent-ready", issues: [] };
}

function validateControlledRollbackRequest(request = {}, {
  allowlist = DEFAULT_ALLOWLIST,
  processedRequestIds = [],
  now = Date.now(),
} = {}) {
  const issues = [];

  if (request.executorId !== EXECUTOR_ID) issues.push("executor_identity_invalid");
  if (request.authority !== AUTHORITY) issues.push("authority_invalid");
  if (request.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (request.failClosed !== true) issues.push("fail_closed_required");
  if (!cleanString(request.actionId)) issues.push("action_id_missing");
  if (!cleanString(request.requestId)) issues.push("request_id_missing");
  if (!cleanString(request.recoveryExecutionId)) issues.push("recovery_execution_reference_missing");
  if (!cleanString(request.verificationReference)) issues.push("verification_reference_missing");

  const allowed = normalizeAllowlist(allowlist);
  if (!allowed.has(cleanString(request.actionId))) {
    return { valid: false, state: "action-not-allowlisted", issues: [...issues, "rollback_action_not_allowlisted"] };
  }

  const seen = new Set(asArray(processedRequestIds).map(cleanString).filter(Boolean));
  if (seen.has(cleanString(request.requestId))) {
    return { valid: false, state: "duplicate-request", issues: [...issues, "rollback_request_already_processed"] };
  }

  const authorisation = validateAuthorisation(request, { now });
  if (!authorisation.valid) {
    return { valid: false, state: authorisation.state, issues: [...issues, ...authorisation.issues] };
  }

  if (issues.length > 0) return { valid: false, state: "denied", issues };
  return { valid: true, state: "approved-intent-ready", issues: [] };
}

async function executeControlledRollback(request = {}, {
  allowlist = DEFAULT_ALLOWLIST,
  adapters = {},
  processedRequestIds = [],
  now = Date.now(),
} = {}) {
  const preflight = validateControlledRollbackRequest(request, {
    allowlist,
    processedRequestIds,
    now,
  });

  const auditBase = {
    executorId: EXECUTOR_ID,
    requestId: cleanString(request?.requestId),
    actionId: cleanString(request?.actionId),
    recoveryExecutionId: cleanString(request?.recoveryExecutionId),
    verificationReference: cleanString(request?.verificationReference),
    approvalId: cleanString(request?.authorisation?.approvalId),
    approvedBy: cleanString(request?.authorisation?.approvedBy),
    scope: cloneValue(request?.scope),
    authority: AUTHORITY,
    evaluatedAt: new Date(now).toISOString(),
  };

  if (!preflight.valid) {
    return {
      success: false,
      state: preflight.state,
      executed: false,
      issues: preflight.issues,
      audit: auditBase,
    };
  }

  const adapter = adapters?.[cleanString(request.actionId)];
  if (typeof adapter !== "function") {
    return {
      success: false,
      state: "adapter-unavailable",
      executed: false,
      issues: ["no_registered_rollback_adapter"],
      audit: auditBase,
    };
  }

  try {
    const result = await adapter({
      requestId: cleanString(request.requestId),
      actionId: cleanString(request.actionId),
      recoveryExecutionId: cleanString(request.recoveryExecutionId),
      verificationReference: cleanString(request.verificationReference),
      scope: cloneValue(request.scope),
      parameters: cloneValue(request.parameters || {}),
      approvalId: cleanString(request.authorisation?.approvalId),
    });

    return {
      success: true,
      state: "execution-succeeded",
      executed: true,
      result: cloneValue(result),
      issues: [],
      audit: auditBase,
      verificationRequired: true,
    };
  } catch (error) {
    return {
      success: false,
      state: "execution-failed",
      executed: true,
      issues: [cleanString(error?.code) || "rollback_adapter_execution_failed"],
      errorMessage: cleanString(error?.message) || "Rollback adapter execution failed.",
      audit: auditBase,
      verificationRequired: true,
    };
  }
}

function getControlledRollbackExecutorManifest() {
  return {
    id: EXECUTOR_ID,
    name: "Movie Mentor Controlled Rollback Executor",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-no-live-adapters",
    purpose: "Execute only separately authorised, explicitly allowlisted rollback actions through registered adapters and fail closed otherwise.",
    authority: AUTHORITY,
    creatorFacing: false,
    autonomousAuthority: false,
    failClosed: true,
    defaultAllowlistSize: DEFAULT_ALLOWLIST.length,
    liveAdapters: false,
    capabilities: [
      "rollback-request-preflight",
      "explicit-allowlist-enforcement",
      "separate-authorisation-validation",
      "scope-and-expiry-validation",
      "idempotency-protection",
      "adapter-bound-execution-contract",
      "audit-evidence-generation",
      "mandatory-post-rollback-verification-flag",
    ],
    restrictions: [
      "no-autonomous-rollback-authority",
      "no-default-allowlisted-actions",
      "no-live-production-adapters",
      "cannot-self-authorise",
      "cannot-expand-scope-or-action-set",
      "cannot-skip-post-rollback-verification",
    ],
  };
}

export {
  VERSION as CONTROLLED_ROLLBACK_EXECUTOR_VERSION,
  CONTRACT_VERSION as CONTROLLED_ROLLBACK_EXECUTOR_CONTRACT_VERSION,
  EXECUTOR_ID as CONTROLLED_ROLLBACK_EXECUTOR_ID,
  AUTHORITY as CONTROLLED_ROLLBACK_EXECUTOR_AUTHORITY,
  EXECUTION_STATES,
  DEFAULT_ALLOWLIST as CONTROLLED_ROLLBACK_DEFAULT_ALLOWLIST,
  createControlledRollbackRequest,
  validateAuthorisation as validateControlledRollbackAuthorisation,
  validateControlledRollbackRequest,
  executeControlledRollback,
  getControlledRollbackExecutorManifest,
};

export default executeControlledRollback;
