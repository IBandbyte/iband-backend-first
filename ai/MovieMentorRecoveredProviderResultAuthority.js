import { digestMovieMentorProviderReconstructionInput } from "./MovieMentorProviderOperationAuthority.js";

const VERSION = "1.3.0";
const DOMAIN = "iband.movie-mentor.recovered-provider-result-authority";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function freeze(value) {
  return Object.freeze(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
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

function historicalInputRequired(historical = {}) {
  fail(
    "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_AUTHORITY_REQUIRED",
    "Recovered provider bytes require the exact immutable historical task-input universe that the provider operation answered.",
    {
      retryable: true,
      providerCallId: text(historical?.providerCallId) || null,
      executionId: text(historical?.executionId) || null,
      slotId: text(historical?.slotId) || null,
      task: text(historical?.task) || null,
    },
  );
}

function historicalInputIntegrityInvalid(historical = {}, recordedDigest = null, observedDigest = null) {
  fail(
    "MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_INTEGRITY_INVALID",
    "Historical provider reconstruction input no longer reproduces its immutable recorded digest.",
    {
      retryable: false,
      providerCallId: text(historical?.providerCallId) || null,
      executionId: text(historical?.executionId) || null,
      slotId: text(historical?.slotId) || null,
      task: text(historical?.task) || null,
      recordedDigest: text(recordedDigest) || null,
      observedDigest: text(observedDigest) || null,
    },
  );
}

async function resolveHistoricalReconstructionInput({ historical, currentInput, readProviderOperation } = {}) {
  if (typeof readProviderOperation !== "function") historicalInputRequired(historical);

  const operation = await readProviderOperation(historical.providerCallId);
  if (
    operation?.authorized === true
    && text(operation.providerCallId) === historical.providerCallId
    && text(operation.executionId) === historical.executionId
    && text(operation.slotId) === historical.slotId
    && text(operation.task) === historical.task
    && text(operation.reconstructionInputDigest)
    && operation.reconstructionInput !== undefined
    && operation.reconstructionInput !== null
  ) {
    const recordedDigest = text(operation.reconstructionInputDigest);
    const observedDigest = digestMovieMentorProviderReconstructionInput(operation.reconstructionInput);
    if (recordedDigest !== observedDigest) {
      historicalInputIntegrityInvalid(historical, recordedDigest, observedDigest);
    }
    return clone(operation.reconstructionInput);
  }

  historicalInputRequired(historical);
}

async function recoverPreviouslyAdmittedProviderResult({
  decision = null,
  execution = null,
  slotId = null,
  task = null,
  input = null,
  recoverProviderOutcome = null,
  readProviderOperation = null,
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
  const historicalInput = await resolveHistoricalReconstructionInput({ historical, currentInput: input, readProviderOperation });
  const providerOperation = freeze({
    providerOperationId: historical.providerCallId,
    executionId: historical.executionId,
    slotId: historical.slotId,
    task: historical.task,
  });

  const reconstructed = await reconstructRecoveredResult({
    input: historicalInput,
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
  resolveHistoricalReconstructionInput,
  recoverPreviouslyAdmittedProviderResult,
};

export default recoverPreviouslyAdmittedProviderResult;
