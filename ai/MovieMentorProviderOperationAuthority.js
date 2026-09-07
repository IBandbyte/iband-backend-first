import {
  describeCurrentMovieMentorProviderTarget,
  normalizeMovieMentorProviderTarget,
  sameMovieMentorProviderTarget,
} from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.0.0";
const DOMAIN = "iband.movie-mentor.provider-operation-authority";

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

function instant(value) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) fail("MOVIE_MENTOR_PROVIDER_OPERATION_TIME_INVALID", "Provider operation identity time is invalid.");
  return parsed;
}

function bindingFromProviderCall(providerCall = {}) {
  const binding = {
    providerCallId: text(providerCall.providerCallId),
    executionId: text(providerCall.executionId),
    slotId: text(providerCall.slotId),
    task: text(providerCall.task),
    ownerId: text(providerCall.ownerId),
    leaseGeneration: Number(providerCall.leaseGeneration),
    leaseReference: text(providerCall.leaseReference),
    fencingToken: text(providerCall.fencingToken),
  };
  if (
    providerCall?.dispatchAuthorized !== true
    || [binding.providerCallId, binding.executionId, binding.slotId, binding.task, binding.ownerId, binding.leaseReference, binding.fencingToken].some((value) => !value)
    || !Number.isSafeInteger(binding.leaseGeneration)
    || binding.leaseGeneration < 1
  ) {
    fail(
      "MOVIE_MENTOR_PROVIDER_OPERATION_CALL_AUTHORITY_REQUIRED",
      "Stable provider operation identity may be bound only from an admitted lease-fenced provider call.",
    );
  }
  return freeze(binding);
}

function sameBinding(record, binding) {
  return text(record?.providerCallId) === binding.providerCallId
    && text(record?.executionId) === binding.executionId
    && text(record?.slotId) === binding.slotId
    && text(record?.task) === binding.task;
}

function operationEvidence(record, extras = {}) {
  return freeze({
    authorized: true,
    domain: DOMAIN,
    providerCallId: text(record.providerCallId),
    providerOperationId: text(record.providerCallId),
    executionId: text(record.executionId),
    slotId: text(record.slotId),
    task: text(record.task),
    providerTarget: normalizeMovieMentorProviderTarget(record.providerTarget),
    boundAt: instant(record.boundAt).toISOString(),
    ...extras,
  });
}

function createMovieMentorProviderOperationAuthority({
  store = null,
  now = () => new Date(),
  resolveCurrentTarget = () => describeCurrentMovieMentorProviderTarget(),
} = {}) {
  if (typeof store?.readOperation !== "function" || typeof store?.bindOperation !== "function") {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_STORE_REQUIRED", "Provider operation authority requires a durable immutable operation identity store.");
  }
  if (typeof resolveCurrentTarget !== "function") {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_TARGET_RESOLVER_REQUIRED", "Provider operation authority requires a current provider target resolver.");
  }

  async function bindOperation({ providerCall = null } = {}) {
    const binding = bindingFromProviderCall(providerCall);
    const providerTarget = normalizeMovieMentorProviderTarget(resolveCurrentTarget());
    const boundAt = instant(now()).toISOString();
    let durable;
    try {
      durable = await store.bindOperation({ ...binding, providerTarget, boundAt });
    } catch (error) {
      durable = await store.readOperation(binding.providerCallId);
      if (!durable) throw error;
    }
    if (!durable) {
      fail("MOVIE_MENTOR_PROVIDER_OPERATION_NOT_DURABLE", "Provider operation identity must be durable before UNKNOWN and provider dispatch.");
    }
    if (!sameBinding(durable, binding)) {
      fail("MOVIE_MENTOR_PROVIDER_OPERATION_IDENTITY_CONFLICT", "Provider operation identity is bound to a different durable provider-call universe.");
    }
    if (!sameMovieMentorProviderTarget(durable.providerTarget, providerTarget)) {
      fail(
        "MOVIE_MENTOR_PROVIDER_OPERATION_TARGET_CONFLICT",
        "Provider operation identity is already bound to a different provider target.",
        { providerCallId: binding.providerCallId },
      );
    }
    return operationEvidence(durable, { bound: true });
  }

  async function readOperation(providerCallId) {
    const callId = text(providerCallId);
    if (!callId) return null;
    const durable = await store.readOperation(callId);
    return durable ? operationEvidence(durable, { read: true }) : null;
  }

  async function assertCurrentTarget({ providerCall = null } = {}) {
    const binding = bindingFromProviderCall(providerCall);
    const durable = await store.readOperation(binding.providerCallId);
    if (!durable) {
      return freeze({ authorized: false, dispatchAuthorized: false, reason: "provider-operation-identity-not-found", providerCallId: binding.providerCallId });
    }
    if (!sameBinding(durable, binding)) {
      return freeze({ authorized: false, dispatchAuthorized: false, reason: "provider-operation-identity-conflict", providerCallId: binding.providerCallId });
    }
    const currentTarget = normalizeMovieMentorProviderTarget(resolveCurrentTarget());
    if (!sameMovieMentorProviderTarget(durable.providerTarget, currentTarget)) {
      return freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: "provider-target-no-longer-current",
        providerCallId: binding.providerCallId,
        providerTarget: normalizeMovieMentorProviderTarget(durable.providerTarget),
        currentProviderTarget: currentTarget,
      });
    }
    return operationEvidence(durable, { dispatchAuthorized: true, currentTargetVerified: true });
  }

  return freeze({ bindOperation, readOperation, assertCurrentTarget });
}

function createMovieMentorProviderOperationBoundaryAuthority({
  leaseAuthority = null,
  providerEffectAuthority = null,
  providerOperationAuthority = null,
} = {}) {
  if (
    typeof leaseAuthority?.assertProviderDispatch !== "function"
    || typeof providerEffectAuthority?.beginDispatch !== "function"
    || typeof providerOperationAuthority?.bindOperation !== "function"
    || typeof providerOperationAuthority?.assertCurrentTarget !== "function"
  ) {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_BOUNDARY_REQUIRED", "Provider operation boundary requires lease, UNKNOWN-effect and stable-operation authorities.");
  }

  async function beginProviderDispatch(input = {}) {
    const operation = await providerOperationAuthority.bindOperation(input);
    const effect = await providerEffectAuthority.beginDispatch(input);
    if (effect?.dispatchAuthorized !== true) return effect;
    return freeze({ ...effect, providerOperationIdentity: operation });
  }

  async function assertProviderDispatch(input = {}) {
    const lease = await leaseAuthority.assertProviderDispatch(input);
    if (lease?.dispatchAuthorized !== true) return lease;
    const operation = await providerOperationAuthority.assertCurrentTarget(input);
    if (operation?.dispatchAuthorized !== true) {
      return freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: operation?.reason || "provider-operation-target-not-current",
        providerCallId: text(input?.providerCall?.providerCallId) || null,
        providerOperationIdentity: operation || null,
      });
    }
    return freeze({ ...lease, providerOperationIdentity: operation });
  }

  return freeze({ beginProviderDispatch, assertProviderDispatch });
}

export {
  VERSION as MOVIE_MENTOR_PROVIDER_OPERATION_AUTHORITY_VERSION,
  DOMAIN as MOVIE_MENTOR_PROVIDER_OPERATION_AUTHORITY_DOMAIN,
  createMovieMentorProviderOperationAuthority,
  createMovieMentorProviderOperationBoundaryAuthority,
};

export default createMovieMentorProviderOperationAuthority;
