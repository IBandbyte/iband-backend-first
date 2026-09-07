const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.recovered-provider-result-authority";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function fail(code, message, extras = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extras);
  throw error;
}

function normalizeHistoricalProviderCall(decision = {}) {
  const existing = decision?.existingProviderCall && typeof decision.existingProviderCall === "object"
    ? decision.existingProviderCall
    : {};
  const providerCallId = text(existing.providerCallId || decision.existingProviderCallId);
  const executionId = text(existing.executionId);
  const slotId = text(existing.slotId);
  const task = text(existing.task);
  if (!providerCallId || !executionId || !slotId || !task) return null;
  return freeze({ providerCallId, executionId, slotId, task });
}

function assertExactHistoricalBinding({ decision, execution, slotId, task } = {}) {
  if (decision?.dispatchAuthorized === true || text(decision?.reason) !== "provider-call-slot-already-admitted") {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_NOT_HISTORICAL_SLOT",
      "Recovered-result authority applies only to an already-admitted historical provider slot.",
      { reason: text(decision?.reason) || null },
    );
  }
  const historical = normalizeHistoricalProviderCall(decision);
  if (!historical) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_OPERATION_BINDING_INVALID",
      "Historical provider-call identity is incomplete and cannot authorize recovery.",
    );
  }
  const expectedExecutionId = text(execution?.executionId);
  const expectedSlotId = text(slotId);
  const expectedTask = text(task);
  if (
    !expectedExecutionId
    || historical.executionId !== expectedExecutionId
    || historical.slotId !== expectedSlotId
    || historical.task !== expectedTask
  ) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_OPERATION_BINDING_INVALID",
      "Historical provider-call identity does not belong to the exact current execution slot and task.",
      {
        historicalExecutionId: historical.executionId,
        currentExecutionId: expectedExecutionId || null,
        historicalSlotId: historical.slotId,
        requestedSlotId: expectedSlotId || null,
        historicalTask: historical.task,
        requestedTask: expectedTask || null,
      },
    );
  }
  return historical;
}

function assertRecoveredOutcomeBinding({ recovery, historical } = {}) {
  if (
    recovery?.outcome !== "CONFIRMED_EFFECT"
    || recovery?.recovered !== true
    || recovery?.recoveryAuthorized !== true
    || recovery?.redispatchAuthorized !== false
    || recovery?.refundAuthorized !== false
    || !recovery?.recoveredProviderResponse
  ) {
    if (recovery?.outcome === "STILL_UNKNOWN") {
      fail(
        "MOVIE_MENTOR_PROVIDER_RECOVERY_STILL_UNKNOWN",
        "Historical provider effect remains unknown and cannot be reconstructed or redispatched.",
        { retryable: true, providerCallId: historical.providerCallId },
      );
    }
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_RESULT_NOT_AUTHORIZED",
      "Historical provider outcome did not establish same-operation recovered response authority.",
      {
        retryable: true,
        providerCallId: historical.providerCallId,
        outcome: text(recovery?.outcome) || null,
        reason: text(recovery?.reason) || null,
      },
    );
  }

  const recoveryProviderCallId = text(recovery?.providerCallId);
  const recoveryExecutionId = text(recovery?.executionId);
  const recoverySlotId = text(recovery?.slotId || historical.slotId);
  const recoveryTask = text(recovery?.task || historical.task);
  if (
    recoveryProviderCallId !== historical.providerCallId
    || recoveryExecutionId !== historical.executionId
    || recoverySlotId !== historical.slotId
    || recoveryTask !== historical.task
  ) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_OUTCOME_BINDING_INVALID",
      "Recovered provider outcome does not bind the exact historical operation universe.",
      { providerCallId: historical.providerCallId },
    );
  }

  return freeze({
    providerCallId: historical.providerCallId,
    executionId: historical.executionId,
    slotId: historical.slotId,
    task: historical.task,
    recoveredProviderResponse: recovery.recoveredProviderResponse,
    recoveryOwnerId: text(recovery?.recoveryOwnerId) || null,
    recoveryLeaseGeneration: Number.isSafeInteger(recovery?.recoveryLeaseGeneration)
      ? recovery.recoveryLeaseGeneration
      : null,
    externalEffectId: text(recovery?.externalEffectId) || null,
  });
}

async function recoverPreviouslyAdmittedProviderResult({
  decision = null,
  execution = null,
  slotId = null,
  task = null,
  input = null,
  recoverProviderOutcome = null,
  reconstructRecoveredResult = null,
} = {}) {
  if (typeof recoverProviderOutcome !== "function") {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_AUTHORITY_REQUIRED",
      "Recovered-result reconstruction requires provider outcome recovery authority.",
    );
  }
  if (typeof reconstructRecoveredResult !== "function") {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_LOCAL_CONTRACT_REQUIRED",
      "Recovered provider bytes require the original local result reconstruction contract.",
    );
  }

  const historical = assertExactHistoricalBinding({ decision, execution, slotId, task });
  const recovery = await recoverProviderOutcome({
    providerCallId: historical.providerCallId,
    recoveryAuthority: execution,
  });
  const bound = assertRecoveredOutcomeBinding({ recovery, historical });
  const providerOperation = freeze({
    providerOperationId: historical.providerCallId,
    executionId: historical.executionId,
    slotId: historical.slotId,
    task: historical.task,
  });

  const reconstructed = await reconstructRecoveredResult({
    input,
    providerOperation,
    recoveredProviderResponse: bound.recoveredProviderResponse,
    recovery: freeze({ ...recovery }),
  });
  if (reconstructed === undefined || reconstructed === null) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECOVERY_LOCAL_RESULT_INVALID",
      "Original local reconstruction contract did not produce an authoritative result.",
      { providerCallId: historical.providerCallId },
    );
  }
  return reconstructed;
}

export {
  VERSION as MOVIE_MENTOR_RECOVERED_PROVIDER_RESULT_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_RECOVERED_PROVIDER_RESULT_AUTHORITY_DOMAIN,
  normalizeHistoricalProviderCall,
  assertExactHistoricalBinding,
  assertRecoveredOutcomeBinding,
  recoverPreviouslyAdmittedProviderResult,
};

export default recoverPreviouslyAdmittedProviderResult;
