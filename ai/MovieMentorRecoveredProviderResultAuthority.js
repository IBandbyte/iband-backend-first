import { digestMovieMentorProviderReconstructionInput } from "./MovieMentorProviderOperationAuthority.js";
import {
  normalizeMovieMentorProviderModel,
  normalizeMovieMentorProviderTarget,
} from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.7.0";
const DOMAIN = "iband.movie-mentor.recovered-provider-result-authority";

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function freeze(value) { return Object.freeze(value); }
function clone(value) { if (value === undefined) return undefined; try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; Object.assign(error, extras); throw error; }

function normalizeHistoricalProviderCall(decision = {}) {
  const existing = decision?.existingProviderCall && typeof decision.existingProviderCall === "object" ? decision.existingProviderCall : {};
  const providerCallId = text(existing.providerCallId || decision.existingProviderCallId);
  const executionId = text(existing.executionId);
  const slotId = text(existing.slotId);
  const task = text(existing.task);
  if (!providerCallId || !executionId || !slotId || !task) return null;
  return freeze({ providerCallId, executionId, slotId, task });
}

function assertExactHistoricalBinding({ decision, execution, slotId, task } = {}) {
  if (decision?.dispatchAuthorized === true || text(decision?.reason) !== "provider-call-slot-already-admitted") {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_NOT_HISTORICAL_SLOT", "Recovered-result authority applies only to an already-admitted historical provider slot.", { reason: text(decision?.reason) || null });
  }
  const historical = normalizeHistoricalProviderCall(decision);
  if (!historical) fail("MOVIE_MENTOR_PROVIDER_RECOVERY_OPERATION_BINDING_INVALID", "Historical provider-call identity is incomplete and cannot authorize recovery.");
  const expectedExecutionId = text(execution?.executionId), expectedSlotId = text(slotId), expectedTask = text(task);
  if (!expectedExecutionId || historical.executionId !== expectedExecutionId || historical.slotId !== expectedSlotId || historical.task !== expectedTask) {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_OPERATION_BINDING_INVALID", "Historical provider-call identity does not belong to the exact current execution slot and task.", {
      historicalExecutionId: historical.executionId, currentExecutionId: expectedExecutionId || null,
      historicalSlotId: historical.slotId, requestedSlotId: expectedSlotId || null,
      historicalTask: historical.task, requestedTask: expectedTask || null,
    });
  }
  return historical;
}

function assertRecoveredOutcomeBinding({ recovery, historical } = {}) {
  if (recovery?.outcome !== "CONFIRMED_EFFECT" || recovery?.recovered !== true || recovery?.recoveryAuthorized !== true || recovery?.redispatchAuthorized !== false || recovery?.refundAuthorized !== false || !recovery?.recoveredProviderResponse) {
    if (recovery?.outcome === "STILL_UNKNOWN") fail("MOVIE_MENTOR_PROVIDER_RECOVERY_STILL_UNKNOWN", "Historical provider effect remains unknown and cannot be reconstructed or redispatched.", { retryable: true, providerCallId: historical.providerCallId });
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_RESULT_NOT_AUTHORIZED", "Historical provider outcome did not establish same-operation recovered response authority.", { retryable: true, providerCallId: historical.providerCallId, outcome: text(recovery?.outcome) || null, reason: text(recovery?.reason) || null });
  }
  const recoveryProviderCallId = text(recovery?.providerCallId), recoveryExecutionId = text(recovery?.executionId), recoverySlotId = text(recovery?.slotId || historical.slotId), recoveryTask = text(recovery?.task || historical.task);
  if (recoveryProviderCallId !== historical.providerCallId || recoveryExecutionId !== historical.executionId || recoverySlotId !== historical.slotId || recoveryTask !== historical.task) {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_OUTCOME_BINDING_INVALID", "Recovered provider outcome does not bind the exact historical operation universe.", { providerCallId: historical.providerCallId });
  }
  const externalEffectId = text(recovery?.externalEffectId), recoveredResponseId = text(recovery?.recoveredProviderResponse?.id);
  if (!externalEffectId || !recoveredResponseId || recoveredResponseId !== externalEffectId) {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_RESPONSE_EFFECT_BINDING_INVALID", "Recovered provider bytes do not bind the exact authorized historical external effect.", { retryable: false, providerCallId: historical.providerCallId, externalEffectId: externalEffectId || null, recoveredResponseId: recoveredResponseId || null });
  }
  return freeze({
    providerCallId: historical.providerCallId, executionId: historical.executionId, slotId: historical.slotId, task: historical.task,
    recoveredProviderResponse: recovery.recoveredProviderResponse,
    recoveryOwnerId: text(recovery?.recoveryOwnerId) || null,
    recoveryLeaseGeneration: Number.isSafeInteger(recovery?.recoveryLeaseGeneration) ? recovery.recoveryLeaseGeneration : null,
    externalEffectId,
  });
}

function assertRecoveryLeaseBinding({ recovery, execution, historical } = {}) {
  const expectedOwnerId = text(execution?.ownerId), actualOwnerId = text(recovery?.recoveryOwnerId);
  const expectedLeaseGeneration = Number.isSafeInteger(execution?.leaseGeneration) ? execution.leaseGeneration : null;
  const actualLeaseGeneration = Number.isSafeInteger(recovery?.recoveryLeaseGeneration) ? recovery.recoveryLeaseGeneration : null;
  if (!expectedOwnerId || expectedLeaseGeneration === null || !actualOwnerId || actualLeaseGeneration === null || actualOwnerId !== expectedOwnerId || actualLeaseGeneration !== expectedLeaseGeneration) {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_LEASE_BINDING_INVALID", "Recovered provider bytes do not belong to the exact current recovery owner and lease generation.", { retryable: false, providerCallId: text(historical?.providerCallId) || null, expectedOwnerId: expectedOwnerId || null, actualOwnerId: actualOwnerId || null, expectedLeaseGeneration, actualLeaseGeneration });
  }
  return true;
}

function historicalInputRequired(historical = {}) {
  fail("MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_AUTHORITY_REQUIRED", "Recovered provider bytes require the exact immutable historical task-input universe that the provider operation answered.", { retryable: true, providerCallId: text(historical?.providerCallId) || null, executionId: text(historical?.executionId) || null, slotId: text(historical?.slotId) || null, task: text(historical?.task) || null });
}
function historicalInputIntegrityInvalid(historical = {}, recordedDigest = null, observedDigest = null) {
  fail("MOVIE_MENTOR_PROVIDER_RECOVERY_INPUT_INTEGRITY_INVALID", "Historical provider reconstruction input no longer reproduces its immutable recorded digest.", { retryable: false, providerCallId: text(historical?.providerCallId) || null, executionId: text(historical?.executionId) || null, slotId: text(historical?.slotId) || null, task: text(historical?.task) || null, recordedDigest: text(recordedDigest) || null, observedDigest: text(observedDigest) || null });
}

function taskTurnContextAuthority(task, input) {
  const normalizedTask = text(task);
  if (normalizedTask === "movie-mentor-semantic") return input?.context?.turnContextAuthority || null;
  if (normalizedTask.startsWith("movie-mentor-specialist:")) return input?.input?.turnContextAuthority || null;
  if (normalizedTask === "movie-mentor-synthesis") return input?.turnContextAuthority || null;
  return null;
}

function normalizeCreatorStateUniverse(authority = null) {
  if (!authority || typeof authority !== "object") return null;
  const revision = Number.isSafeInteger(authority.revision) && authority.revision >= 0 ? authority.revision : null;
  const snapshotReference = text(authority.snapshotReference);
  const generation = Number.isSafeInteger(authority?.creatorState?.generation) && authority.creatorState.generation >= 0 ? authority.creatorState.generation : null;
  const fingerprint = text(authority?.creatorState?.fingerprint);
  if (revision === null || !snapshotReference || generation === null || !fingerprint) return null;
  return freeze({
    revision,
    revisionAuthorityReference: text(authority.revisionAuthorityReference) || null,
    snapshotFingerprint: text(authority.snapshotFingerprint) || null,
    snapshotReference,
    creatorStateGeneration: generation,
    creatorStateFingerprint: fingerprint,
    creatorStateAuthorityReference: text(authority?.creatorState?.authorityReference) || null,
  });
}

function sameCreatorStateUniverse(left, right) {
  return Boolean(left && right
    && left.revision === right.revision
    && left.revisionAuthorityReference === right.revisionAuthorityReference
    && left.snapshotFingerprint === right.snapshotFingerprint
    && left.snapshotReference === right.snapshotReference
    && left.creatorStateGeneration === right.creatorStateGeneration
    && left.creatorStateFingerprint === right.creatorStateFingerprint
    && left.creatorStateAuthorityReference === right.creatorStateAuthorityReference);
}

function assertCurrentCreatorStateUniverse({ historical, historicalInput, currentInput } = {}) {
  const historicalUniverse = normalizeCreatorStateUniverse(taskTurnContextAuthority(historical?.task, historicalInput));
  const currentUniverse = normalizeCreatorStateUniverse(taskTurnContextAuthority(historical?.task, currentInput));
  if (!historicalUniverse && !currentUniverse) return true;
  if (!sameCreatorStateUniverse(historicalUniverse, currentUniverse)) {
    fail("MOVIE_MENTOR_PROVIDER_RECOVERY_CREATOR_STATE_UNIVERSE_CONFLICT", "Recovered historical provider input belongs to a different creator-state authority universe than the current retry.", {
      retryable: false,
      providerCallId: text(historical?.providerCallId) || null,
      task: text(historical?.task) || null,
      historicalCreatorStateUniverse: clone(historicalUniverse),
      currentCreatorStateUniverse: clone(currentUniverse),
    });
  }
  return true;
}

async function resolveHistoricalReconstructionAuthority({ historical, readProviderOperation } = {}) {
  if (typeof readProviderOperation !== "function") historicalInputRequired(historical);
  const operation = await readProviderOperation(historical.providerCallId);
  if (operation?.authorized === true && text(operation.providerCallId) === historical.providerCallId && text(operation.executionId) === historical.executionId && text(operation.slotId) === historical.slotId && text(operation.task) === historical.task && text(operation.reconstructionInputDigest) && operation.reconstructionInput !== undefined && operation.reconstructionInput !== null) {
    const recordedDigest = text(operation.reconstructionInputDigest);
    const observedDigest = digestMovieMentorProviderReconstructionInput(operation.reconstructionInput);
    if (recordedDigest !== observedDigest) historicalInputIntegrityInvalid(historical, recordedDigest, observedDigest);
    if (!operation.providerTarget || typeof operation.providerTarget !== "object" || !Object.prototype.hasOwnProperty.call(operation, "providerModel")) {
      fail("MOVIE_MENTOR_PROVIDER_RECOVERY_MODEL_AUTHORITY_REQUIRED", "Recovered provider bytes require explicit durable historical provider target and model authority before local reconstruction.", { retryable: false, providerCallId: historical.providerCallId });
    }
    let providerTarget, providerModel;
    try {
      providerTarget = normalizeMovieMentorProviderTarget(operation.providerTarget);
      providerModel = operation.providerModel == null ? null : normalizeMovieMentorProviderModel(operation.providerModel, { provider: providerTarget.provider });
      if (providerTarget.provider === "openai" && !providerModel) throw new Error("openai historical model authority missing");
    } catch {
      fail("MOVIE_MENTOR_PROVIDER_RECOVERY_MODEL_AUTHORITY_INVALID", "Historical provider target/model authority is invalid and cannot authorize recovered local reconstruction.", { retryable: false, providerCallId: historical.providerCallId });
    }
    return freeze({ historicalInput: clone(operation.reconstructionInput), providerTarget, providerModel, providerModelAuthorityBound: true });
  }
  historicalInputRequired(historical);
}

async function resolveHistoricalReconstructionInput({ historical, currentInput, readProviderOperation } = {}) {
  const authority = await resolveHistoricalReconstructionAuthority({ historical, readProviderOperation });
  assertCurrentCreatorStateUniverse({ historical, historicalInput: authority.historicalInput, currentInput });
  return clone(authority.historicalInput);
}

async function recoverPreviouslyAdmittedProviderResult({ decision = null, execution = null, slotId = null, task = null, input = null, recoverProviderOutcome = null, readProviderOperation = null, reconstructRecoveredResult = null } = {}) {
  if (typeof recoverProviderOutcome !== "function") fail("MOVIE_MENTOR_PROVIDER_RECOVERY_AUTHORITY_REQUIRED", "Recovered-result reconstruction requires provider outcome recovery authority.");
  if (typeof reconstructRecoveredResult !== "function") fail("MOVIE_MENTOR_PROVIDER_RECOVERY_LOCAL_CONTRACT_REQUIRED", "Recovered provider bytes require the original local result reconstruction contract.");
  const historical = assertExactHistoricalBinding({ decision, execution, slotId, task });
  const recovery = await recoverProviderOutcome({ providerCallId: historical.providerCallId, recoveryAuthority: execution });
  const bound = assertRecoveredOutcomeBinding({ recovery, historical });
  assertRecoveryLeaseBinding({ recovery, execution, historical });
  const reconstructionAuthority = await resolveHistoricalReconstructionAuthority({ historical, readProviderOperation });
  assertCurrentCreatorStateUniverse({ historical, historicalInput: reconstructionAuthority.historicalInput, currentInput: input });
  const providerOperation = freeze({
    providerOperationId: historical.providerCallId, executionId: historical.executionId, slotId: historical.slotId, task: historical.task,
    providerTarget: reconstructionAuthority.providerTarget, providerModelAuthorityBound: true, providerModel: reconstructionAuthority.providerModel,
  });
  const reconstructed = await reconstructRecoveredResult({ input: clone(reconstructionAuthority.historicalInput), providerOperation, recoveredProviderResponse: bound.recoveredProviderResponse, recovery: freeze({ ...recovery }) });
  if (reconstructed === undefined || reconstructed === null) fail("MOVIE_MENTOR_PROVIDER_RECOVERY_LOCAL_RESULT_INVALID", "Original local reconstruction contract did not produce an authoritative result.", { providerCallId: historical.providerCallId });
  return reconstructed;
}

export {
  VERSION as MOVIE_MENTOR_RECOVERED_PROVIDER_RESULT_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_RECOVERED_PROVIDER_RESULT_AUTHORITY_DOMAIN,
  normalizeHistoricalProviderCall,
  assertExactHistoricalBinding,
  assertRecoveredOutcomeBinding,
  assertRecoveryLeaseBinding,
  taskTurnContextAuthority,
  normalizeCreatorStateUniverse,
  sameCreatorStateUniverse,
  assertCurrentCreatorStateUniverse,
  resolveHistoricalReconstructionInput,
  recoverPreviouslyAdmittedProviderResult,
};

export default recoverPreviouslyAdmittedProviderResult;
