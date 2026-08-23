/**
 * Movie Mentor Controlled Recovery Executor
 * ------------------------------------------------------------
 * Fail-closed execution contract for future authorised Operations recovery.
 *
 * STATUS:
 * - Standalone architecture only.
 * - NOT wired to production systems, queues, providers or infrastructure.
 * - NOT creator-facing.
 * - NO LIVE RECOVERY ADAPTERS.
 * - NO AUTONOMOUS AUTHORITY.
 */

const VERSION = "1.0.0";
const CONTRACT_VERSION = "1.0.0";
const EXECUTOR_ID = "controlled-recovery-executor";
const AUTHORITY = "operations-approved-recovery-execution-contract-only";

const EXECUTION_STATES = Object.freeze([
  "approved-intent-ready",
  "denied",
  "expired-authorisation",
  "scope-mismatch",
  "action-not-allowlisted",
  "invalid-authorisation",
  "duplicate-request",
  "execution-adapter-unavailable",
]);

const DEFAULT_ALLOWED_ACTION_IDS = Object.freeze([
  "retry-job-within-approved-limit",
  "quarantine-approved-queue-item",
  "invoke-approved-provider-fallback",
  "restore-approved-known-configuration",
  "invoke-approved-recovery-runbook",
]);

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
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function createControlledRecoveryRequest({
  requestId,
  actionId,
  targetScope,
  parameters = {},
  requestedBy,
  authorisation = {},
  evidenceReferences = [],
  idempotencyKey,
  metadata = {},
} = {}) {
  return {
    executorId: EXECUTOR_ID,
    requestId: cleanString(requestId),
    actionId: cleanString(actionId),
    targetScope: cloneValue(targetScope),
    parameters: cloneValue(parameters || {}),
    requestedBy: cleanString(requestedBy),
    authorisation: cloneValue(authorisation || {}),
    evidenceReferences: cloneValue(asArray(evidenceReferences)),
    idempotencyKey: cleanString(idempotencyKey),
    metadata: cloneValue(metadata || {}),
    authority: AUTHORITY,
    creatorFacing: false,
  };
}

function validateAuthorisation(authorisation = {}, request = {}, now = new Date()) {
  const issues = [];
  const approvalId = cleanString(authorisation.approvalId);
  const approvedActionId = cleanString(authorisation.actionId);
  const approvedBy = cleanString(authorisation.approvedBy);
  const expiresAt = cleanString(authorisation.expiresAt);
  const approvedScope = authorisation.targetScope;

  if (!approvalId) issues.push("approval_id_required");
  if (!approvedBy) issues.push("approved_by_required");
  if (!approvedActionId) issues.push("approved_action_id_required");
  if (approvedActionId && approvedActionId !== request.actionId) issues.push("approved_action_mismatch");
  if (approvedScope === undefined || approvedScope === null) issues.push("approved_scope_required");

  const expiryMs = parseTime(expiresAt);
  if (!expiresAt || expiryMs === null) {
    issues.push("valid_expiry_required");
  } else if (expiryMs <= now.getTime()) {
    issues.push("authorisation_expired");
  }

  const requestScope = JSON.stringify(request.targetScope ?? null);
  const authorityScope = JSON.stringify(approvedScope ?? null);
  if (requestScope !== authorityScope) issues.push("approved_scope_mismatch");

  if (authorisation.revoked === true) issues.push("authorisation_revoked");
  if (authorisation.explicitApproval !== true) issues.push("explicit_approval_required");

  return { valid: issues.length === 0, issues };
}

function validateControlledRecoveryRequest(
  request = {},
  {
    allowedActionIds = DEFAULT_ALLOWED_ACTION_IDS,
    usedIdempotencyKeys = [],
    now = new Date(),
  } = {},
) {
  const issues = [];

  if (request.executorId !== EXECUTOR_ID) issues.push("executor_identity_invalid");
  if (request.authority !== AUTHORITY) issues.push("authority_invalid");
  if (request.creatorFacing !== false) issues.push("creator_facing_forbidden");
  if (!cleanString(request.requestId)) issues.push("request_id_required");
  if (!cleanString(request.actionId)) issues.push("action_id_required");
  if (request.targetScope === undefined || request.targetScope === null) issues.push("target_scope_required");
  if (!cleanString(request.requestedBy)) issues.push("requester_identity_required");
  if (!cleanString(request.idempotencyKey)) issues.push("idempotency_key_required");

  if (!asArray(allowedActionIds).includes(request.actionId)) issues.push("action_not_allowlisted");
  if (asArray(usedIdempotencyKeys).includes(request.idempotencyKey)) issues.push("duplicate_request");

  const authValidation = validateAuthorisation(request.authorisation, request, now);
  issues.push(...authValidation.issues);

  return {
    valid: issues.length === 0,
    issues,
  };
}

function deriveDeniedState(issues = []) {
  if (issues.includes("action_not_allowlisted")) return "action-not-allowlisted";
  if (issues.includes("authorisation_expired")) return "expired-authorisation";
  if (issues.includes("approved_scope_mismatch")) return "scope-mismatch";
  if (issues.includes("duplicate_request")) return "duplicate-request";
  if (
    issues.some((issue) =>
      [
        "approval_id_required",
        "approved_by_required",
        "approved_action_id_required",
        "approved_action_mismatch",
        "approved_scope_required",
        "valid_expiry_required",
        "authorisation_revoked",
        "explicit_approval_required",
      ].includes(issue),
    )
  ) {
    return "invalid-authorisation";
  }
  return "denied";
}

function prepareControlledRecoveryExecutionIntent(
  request = {},
  {
    allowedActionIds = DEFAULT_ALLOWED_ACTION_IDS,
    usedIdempotencyKeys = [],
    now = new Date(),
    adapterRegistry = {},
  } = {},
) {
  const validation = validateControlledRecoveryRequest(request, {
    allowedActionIds,
    usedIdempotencyKeys,
    now,
  });

  if (!validation.valid) {
    return {
      success: false,
      state: deriveDeniedState(validation.issues),
      executionPermitted: false,
      issues: validation.issues,
      auditRecord: {
        executorId: EXECUTOR_ID,
        requestId: request.requestId || null,
        actionId: request.actionId || null,
        targetScope: cloneValue(request.targetScope),
        requestedBy: request.requestedBy || null,
        approvalId: request?.authorisation?.approvalId || null,
        idempotencyKey: request.idempotencyKey || null,
        evaluatedAt: now.toISOString(),
        outcome: "denied",
      },
    };
  }

  const adapter = adapterRegistry?.[request.actionId];
  if (typeof adapter !== "function") {
    return {
      success: false,
      state: "execution-adapter-unavailable",
      executionPermitted: false,
      issues: ["no_live_execution_adapter_registered"],
      executionIntent: {
        actionId: request.actionId,
        targetScope: cloneValue(request.targetScope),
        parameters: cloneValue(request.parameters || {}),
      },
      auditRecord: {
        executorId: EXECUTOR_ID,
        requestId: request.requestId,
        actionId: request.actionId,
        targetScope: cloneValue(request.targetScope),
        requestedBy: request.requestedBy,
        approvalId: request.authorisation.approvalId,
        idempotencyKey: request.idempotencyKey,
        evaluatedAt: now.toISOString(),
        outcome: "adapter-unavailable",
      },
    };
  }

  return {
    success: true,
    state: "approved-intent-ready",
    executionPermitted: true,
    executionIntent: {
      actionId: request.actionId,
      targetScope: cloneValue(request.targetScope),
      parameters: cloneValue(request.parameters || {}),
      adapterRegistered: true,
    },
    auditRecord: {
      executorId: EXECUTOR_ID,
      requestId: request.requestId,
      actionId: request.actionId,
      targetScope: cloneValue(request.targetScope),
      requestedBy: request.requestedBy,
      approvalId: request.authorisation.approvalId,
      approvedBy: request.authorisation.approvedBy,
      idempotencyKey: request.idempotencyKey,
      evaluatedAt: now.toISOString(),
      outcome: "approved-intent-ready",
    },
  };
}

async function executeControlledRecovery(
  request = {},
  options = {},
) {
  const prepared = prepareControlledRecoveryExecutionIntent(request, options);

  if (!prepared.success || prepared.executionPermitted !== true) {
    return prepared;
  }

  const adapter = options.adapterRegistry?.[request.actionId];
  if (typeof adapter !== "function") {
    return {
      ...prepared,
      success: false,
      state: "execution-adapter-unavailable",
      executionPermitted: false,
    };
  }

  const result = await adapter({
    requestId: request.requestId,
    actionId: request.actionId,
    targetScope: cloneValue(request.targetScope),
    parameters: cloneValue(request.parameters || {}),
    approvalId: request.authorisation.approvalId,
    idempotencyKey: request.idempotencyKey,
  });

  return {
    success: true,
    state: "approved-intent-ready",
    executionPermitted: true,
    result: cloneValue(result),
    auditRecord: {
      ...prepared.auditRecord,
      executedAt: new Date().toISOString(),
      outcome: "adapter-invoked",
    },
  };
}

function getControlledRecoveryExecutorManifest() {
  return {
    id: EXECUTOR_ID,
    name: "Movie Mentor Controlled Recovery Executor",
    version: VERSION,
    contractVersion: CONTRACT_VERSION,
    status: "standalone-dormant-no-live-adapters",
    purpose: "Provide a fail-closed contract for narrowly authorised recovery actions without autonomous execution authority.",
    authority: AUTHORITY,
    creatorFacing: false,
    autonomousAuthority: false,
    failClosed: true,
    defaultAllowedActionIds: DEFAULT_ALLOWED_ACTION_IDS,
    requirements: [
      "explicit-approval",
      "allowlisted-action-id",
      "exact-scope-match",
      "unexpired-authorisation",
      "idempotency-key",
      "audit-record",
      "registered-execution-adapter",
    ],
    restrictions: [
      "cannot-invent-recovery-actions",
      "cannot-self-approve",
      "cannot-expand-authority",
      "cannot-execute-without-registered-adapter",
      "no-live-production-adapters-in-v1",
    ],
  };
}

export {
  VERSION as CONTROLLED_RECOVERY_EXECUTOR_VERSION,
  CONTRACT_VERSION as CONTROLLED_RECOVERY_EXECUTOR_CONTRACT_VERSION,
  EXECUTOR_ID as CONTROLLED_RECOVERY_EXECUTOR_ID,
  AUTHORITY as CONTROLLED_RECOVERY_EXECUTOR_AUTHORITY,
  EXECUTION_STATES,
  DEFAULT_ALLOWED_ACTION_IDS,
  createControlledRecoveryRequest,
  validateAuthorisation,
  validateControlledRecoveryRequest,
  prepareControlledRecoveryExecutionIntent,
  executeControlledRecovery,
  getControlledRecoveryExecutorManifest,
};

export default executeControlledRecovery;
