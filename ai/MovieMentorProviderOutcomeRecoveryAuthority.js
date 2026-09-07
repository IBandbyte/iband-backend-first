import {
  describeCurrentMovieMentorProviderTarget,
  normalizeMovieMentorProviderTarget,
  sameMovieMentorProviderTarget,
} from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.provider-outcome-recovery-authority";
const OUTCOMES = Object.freeze({
  CONFIRMED_EFFECT: "CONFIRMED_EFFECT",
  STILL_UNKNOWN: "STILL_UNKNOWN",
  CONFLICTING_EFFECT: "CONFLICTING_EFFECT",
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  try { return structuredClone(value); } catch { return value; }
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function operationBinding(operation = {}) {
  const binding = {
    providerCallId: text(operation.providerCallId || operation.providerOperationId),
    executionId: text(operation.executionId),
    slotId: text(operation.slotId),
    task: text(operation.task),
  };
  if (Object.values(binding).some((value) => !value)) {
    fail(
      "MOVIE_MENTOR_PROVIDER_OUTCOME_OPERATION_INVALID",
      "Provider outcome recovery requires complete durable provider operation identity.",
    );
  }
  return freeze(binding);
}

function assertEffectBinding(effect, binding) {
  if (!effect || typeof effect !== "object") return false;
  return text(effect.providerCallId) === binding.providerCallId
    && text(effect.executionId) === binding.executionId
    && text(effect.slotId) === binding.slotId
    && text(effect.task) === binding.task;
}

function evidenceList(effect = {}) {
  return Array.isArray(effect.evidence)
    ? effect.evidence.map((entry) => freeze({
      externalEffectId: text(entry?.externalEffectId),
      provider: text(entry?.provider),
      observedAt: text(entry?.observedAt) || null,
      source: text(entry?.source) || null,
    }))
    : [];
}

function stillUnknown(binding, operation, extras = {}) {
  return freeze({
    authorized: true,
    domain: DOMAIN,
    outcome: OUTCOMES.STILL_UNKNOWN,
    providerCallId: binding.providerCallId,
    providerOperationId: binding.providerCallId,
    executionId: binding.executionId,
    slotId: binding.slotId,
    task: binding.task,
    providerTarget: normalizeMovieMentorProviderTarget(operation.providerTarget),
    recoveryAuthorized: false,
    recovered: false,
    redispatchAuthorized: false,
    refundAuthorized: false,
    ...extras,
  });
}

function confirmedEffect(binding, operation, externalEffectId, extras = {}) {
  return freeze({
    authorized: true,
    domain: DOMAIN,
    outcome: OUTCOMES.CONFIRMED_EFFECT,
    providerCallId: binding.providerCallId,
    providerOperationId: binding.providerCallId,
    executionId: binding.executionId,
    slotId: binding.slotId,
    task: binding.task,
    providerTarget: normalizeMovieMentorProviderTarget(operation.providerTarget),
    externalEffectId,
    redispatchAuthorized: false,
    refundAuthorized: false,
    ...extras,
  });
}

function conflictingEffect(binding, operation, extras = {}) {
  return freeze({
    authorized: false,
    domain: DOMAIN,
    outcome: OUTCOMES.CONFLICTING_EFFECT,
    providerCallId: binding.providerCallId,
    providerOperationId: binding.providerCallId,
    executionId: binding.executionId,
    slotId: binding.slotId,
    task: binding.task,
    providerTarget: normalizeMovieMentorProviderTarget(operation.providerTarget),
    recoveryAuthorized: false,
    recovered: false,
    redispatchAuthorized: false,
    refundAuthorized: false,
    ...extras,
  });
}

function createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation = null,
  readProviderEffectReality = null,
  recoverProviderResponse = null,
  resolveCurrentTarget = () => describeCurrentMovieMentorProviderTarget(),
} = {}) {
  if (typeof readProviderOperation !== "function" || typeof readProviderEffectReality !== "function") {
    fail(
      "MOVIE_MENTOR_PROVIDER_OUTCOME_DURABLE_READERS_REQUIRED",
      "Provider outcome recovery requires durable provider operation and provider-effect reality readers.",
    );
  }
  if (typeof recoverProviderResponse !== "function") {
    fail(
      "MOVIE_MENTOR_PROVIDER_OUTCOME_RECOVERY_ADAPTER_REQUIRED",
      "Provider outcome recovery requires an explicit provider recovery adapter.",
    );
  }
  if (typeof resolveCurrentTarget !== "function") {
    fail(
      "MOVIE_MENTOR_PROVIDER_OUTCOME_TARGET_RESOLVER_REQUIRED",
      "Provider outcome recovery requires a current provider target resolver.",
    );
  }

  async function reconcile({ providerCallId = null } = {}) {
    const callId = text(providerCallId);
    if (!callId) {
      fail("MOVIE_MENTOR_PROVIDER_OUTCOME_CALL_ID_REQUIRED", "Provider outcome recovery requires an exact durable provider call ID.");
    }

    const operation = await readProviderOperation(callId);
    if (!operation) {
      return freeze({
        authorized: false,
        domain: DOMAIN,
        outcome: OUTCOMES.STILL_UNKNOWN,
        providerCallId: callId,
        providerOperationId: callId,
        recoveryAuthorized: false,
        recovered: false,
        redispatchAuthorized: false,
        refundAuthorized: false,
        reason: "provider-operation-not-found",
      });
    }

    const binding = operationBinding(operation);
    if (binding.providerCallId !== callId) {
      fail(
        "MOVIE_MENTOR_PROVIDER_OUTCOME_OPERATION_IDENTITY_CONFLICT",
        "Recovered provider operation identity does not match the requested historical provider call.",
      );
    }

    const effect = await readProviderEffectReality(callId);
    if (!effect) {
      return stillUnknown(binding, operation, { reason: "provider-effect-reality-not-found" });
    }
    if (!assertEffectBinding(effect, binding)) {
      return conflictingEffect(binding, operation, { reason: "provider-effect-binding-conflict" });
    }

    const state = text(effect.state);
    const evidence = evidenceList(effect);
    if (state === "unknown") {
      if (evidence.length !== 0) {
        return conflictingEffect(binding, operation, { reason: "unknown-provider-effect-carries-evidence" });
      }
      return stillUnknown(binding, operation, { reason: "provider-effect-still-unknown" });
    }
    if (state === "conflict") {
      return conflictingEffect(binding, operation, {
        reason: "provider-effect-conflict",
        externalEffectIds: freeze(evidence.map((entry) => entry.externalEffectId).filter(Boolean)),
      });
    }
    if (state !== "confirmed" || evidence.length !== 1 || !evidence[0].externalEffectId || !evidence[0].provider) {
      return conflictingEffect(binding, operation, { reason: "provider-effect-confirmation-invalid" });
    }

    const providerTarget = normalizeMovieMentorProviderTarget(operation.providerTarget);
    const externalEffectId = evidence[0].externalEffectId;
    if (evidence[0].provider !== providerTarget.provider) {
      return conflictingEffect(binding, operation, {
        reason: "provider-effect-provider-mismatch",
        evidenceProvider: evidence[0].provider,
      });
    }

    if (providerTarget.recoveryMode !== "known-response-id-retrieval") {
      return confirmedEffect(binding, operation, externalEffectId, {
        recoveryAuthorized: false,
        recovered: false,
        reason: "provider-recovery-capability-not-declared",
      });
    }

    const currentTarget = normalizeMovieMentorProviderTarget(resolveCurrentTarget());
    if (!sameMovieMentorProviderTarget(providerTarget, currentTarget)) {
      return confirmedEffect(binding, operation, externalEffectId, {
        recoveryAuthorized: false,
        recovered: false,
        reason: "provider-target-no-longer-current",
        currentProviderTarget: currentTarget,
      });
    }

    const request = freeze({
      method: "retrieve-known-response-id",
      providerCallId: binding.providerCallId,
      providerOperationId: binding.providerCallId,
      executionId: binding.executionId,
      slotId: binding.slotId,
      task: binding.task,
      externalEffectId,
      providerTarget,
    });

    let recovered;
    try {
      recovered = await recoverProviderResponse(request);
    } catch (error) {
      return confirmedEffect(binding, operation, externalEffectId, {
        recoveryAuthorized: true,
        recovered: false,
        retryable: error?.retryable !== false,
        reason: "provider-recovery-request-failed",
        recoveryErrorCode: text(error?.code) || null,
      });
    }

    if (
      !recovered
      || text(recovered.provider) !== providerTarget.provider
      || text(recovered.externalEffectId) !== externalEffectId
      || !recovered.response
      || typeof recovered.response !== "object"
    ) {
      return conflictingEffect(binding, operation, {
        reason: "provider-recovery-response-binding-invalid",
      });
    }
    const responseId = text(recovered.response.id);
    if (responseId && responseId !== externalEffectId) {
      return conflictingEffect(binding, operation, {
        reason: "provider-recovery-response-id-conflict",
        recoveredResponseId: responseId,
        externalEffectId,
      });
    }

    return confirmedEffect(binding, operation, externalEffectId, {
      recoveryAuthorized: true,
      recovered: true,
      recoveryMethod: request.method,
      recoveredProviderResponse: clone(recovered.response),
    });
  }

  return freeze({ reconcile });
}

export {
  VERSION as MOVIE_MENTOR_PROVIDER_OUTCOME_RECOVERY_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_PROVIDER_OUTCOME_RECOVERY_AUTHORITY_DOMAIN,
  OUTCOMES as MOVIE_MENTOR_PROVIDER_OUTCOME_RECOVERY_OUTCOMES,
  createMovieMentorProviderOutcomeRecoveryAuthority,
};

export default createMovieMentorProviderOutcomeRecoveryAuthority;
