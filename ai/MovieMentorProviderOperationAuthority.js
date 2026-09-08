import crypto from "node:crypto";
import {
  describeCurrentMovieMentorProviderModel,
  describeCurrentMovieMentorProviderTarget,
  normalizeMovieMentorProviderModel,
  normalizeMovieMentorProviderTarget,
  sameMovieMentorProviderModel,
  sameMovieMentorProviderTarget,
} from "./MovieMentorProviderTargetAuthority.js";

const VERSION = "1.4.0";
const DOMAIN = "iband.movie-mentor.provider-operation-authority";

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

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
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

function assertReconstructionInputIntegrity(record = {}) {
  const providerCallId = text(record?.providerCallId) || null;
  const recordedDigest = text(record?.reconstructionInputDigest);
  const hasPayload = record?.reconstructionInput !== undefined;

  if (!recordedDigest) {
    if (hasPayload && record.reconstructionInput !== null) {
      fail(
        "MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_INTEGRITY_INVALID",
        "Provider operation carries reconstruction input bytes without an immutable reconstruction-input digest.",
        { providerCallId, recordedDigest: null, observedDigest: null },
      );
    }
    return freeze({ inputBound: false, recordedDigest: null, observedDigest: null });
  }

  if (!hasPayload) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_INTEGRITY_INVALID",
      "Provider operation carries a reconstruction-input digest without the reconstruction input bytes it claims to bind.",
      { providerCallId, recordedDigest, observedDigest: null },
    );
  }

  let observedDigest;
  try {
    observedDigest = digest(record.reconstructionInput);
  } catch {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_INTEGRITY_INVALID",
      "Provider operation reconstruction input cannot be canonically digested.",
      { providerCallId, recordedDigest, observedDigest: null },
    );
  }

  if (observedDigest !== recordedDigest) {
    fail(
      "MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_INTEGRITY_INVALID",
      "Provider operation reconstruction input no longer reproduces its immutable recorded digest.",
      { providerCallId, recordedDigest, observedDigest },
    );
  }

  return freeze({ inputBound: true, recordedDigest, observedDigest });
}

function operationEvidence(record, extras = {}) {
  const inputIntegrity = assertReconstructionInputIntegrity(record);
  const providerTarget = normalizeMovieMentorProviderTarget(record.providerTarget);
  const providerModel = record.providerModel == null
    ? null
    : normalizeMovieMentorProviderModel(record.providerModel, { provider: providerTarget.provider });
  return freeze({
    authorized: true,
    domain: DOMAIN,
    providerCallId: text(record.providerCallId),
    providerOperationId: text(record.providerCallId),
    executionId: text(record.executionId),
    slotId: text(record.slotId),
    task: text(record.task),
    providerTarget,
    providerModel,
    boundAt: instant(record.boundAt).toISOString(),
    reconstructionInputDigest: inputIntegrity.recordedDigest,
    reconstructionInput: inputIntegrity.inputBound ? clone(record.reconstructionInput) : null,
    reconstructionInputBoundAt: record.reconstructionInputBoundAt ? instant(record.reconstructionInputBoundAt).toISOString() : null,
    reconstructionInputIntegrityVerified: inputIntegrity.inputBound,
    ...extras,
  });
}

function createMovieMentorProviderOperationAuthority({
  store = null,
  now = () => new Date(),
  resolveCurrentTarget = () => describeCurrentMovieMentorProviderTarget(),
  resolveCurrentModel = ({ providerTarget } = {}) => describeCurrentMovieMentorProviderModel({ providerTarget }),
} = {}) {
  if (typeof store?.readOperation !== "function" || typeof store?.bindOperation !== "function") {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_STORE_REQUIRED", "Provider operation authority requires a durable immutable operation identity store.");
  }
  if (typeof resolveCurrentTarget !== "function") {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_TARGET_RESOLVER_REQUIRED", "Provider operation authority requires a current provider target resolver.");
  }
  if (typeof resolveCurrentModel !== "function") {
    fail("MOVIE_MENTOR_PROVIDER_OPERATION_MODEL_RESOLVER_REQUIRED", "Provider operation authority requires a current provider model resolver.");
  }

  function currentIdentity() {
    const providerTarget = normalizeMovieMentorProviderTarget(resolveCurrentTarget());
    const providerModel = normalizeMovieMentorProviderModel(resolveCurrentModel({ providerTarget }), { provider: providerTarget.provider });
    return freeze({ providerTarget, providerModel });
  }

  async function bindOperation({ providerCall = null } = {}) {
    const binding = bindingFromProviderCall(providerCall);
    const { providerTarget, providerModel } = currentIdentity();
    const boundAt = instant(now()).toISOString();
    let durable;
    try {
      durable = await store.bindOperation({ ...binding, providerTarget, providerModel, boundAt });
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
    if (!sameMovieMentorProviderModel(durable.providerModel, providerModel)) {
      fail(
        "MOVIE_MENTOR_PROVIDER_OPERATION_MODEL_CONFLICT",
        "Provider operation identity is already bound to a different inference model.",
        { providerCallId: binding.providerCallId },
      );
    }
    return operationEvidence(durable, { bound: true });
  }

  async function bindReconstructionInput({ providerCall = null, reconstructionInput = undefined } = {}) {
    if (typeof store?.bindReconstructionInput !== "function") {
      fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_STORE_REQUIRED", "Provider reconstruction input requires durable immutable input-binding capability.");
    }
    const binding = bindingFromProviderCall(providerCall);
    if (reconstructionInput === undefined) {
      fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_REQUIRED", "Provider reconstruction input must exist before UNKNOWN may begin.");
    }
    const operation = await bindOperation({ providerCall });
    const inputDigest = digest(reconstructionInput);
    const durable = await store.bindReconstructionInput({
      ...binding,
      reconstructionInputDigest: inputDigest,
      reconstructionInput: clone(reconstructionInput),
      boundAt: instant(now()).toISOString(),
    });
    if (!sameBinding(durable, binding)) {
      fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_IDENTITY_CONFLICT", "Provider reconstruction input is bound to a different provider-call universe.");
    }
    if (text(durable.reconstructionInputDigest) !== inputDigest) {
      fail("MOVIE_MENTOR_PROVIDER_RECONSTRUCTION_INPUT_CONFLICT", "Provider operation is already bound to a different historical reconstruction input.", {
        providerCallId: binding.providerCallId,
      });
    }
    return operationEvidence(durable, {
      bound: true,
      inputBound: true,
      providerOperationIdentity: operation,
    });
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
    const durableModel = durable.providerModel == null
      ? null
      : normalizeMovieMentorProviderModel(durable.providerModel, { provider: currentTarget.provider });
    if (currentTarget.provider === "openai" && !durableModel) {
      return freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: "provider-model-authority-not-bound",
        providerCallId: binding.providerCallId,
        providerTarget: normalizeMovieMentorProviderTarget(durable.providerTarget),
      });
    }
    const currentModel = normalizeMovieMentorProviderModel(resolveCurrentModel({ providerTarget: currentTarget }), { provider: currentTarget.provider });
    if (!sameMovieMentorProviderModel(durableModel, currentModel)) {
      return freeze({
        authorized: false,
        dispatchAuthorized: false,
        reason: "provider-model-no-longer-current",
        providerCallId: binding.providerCallId,
        providerTarget: normalizeMovieMentorProviderTarget(durable.providerTarget),
        providerModel: durableModel,
        currentProviderModel: currentModel,
      });
    }
    return operationEvidence(durable, { dispatchAuthorized: true, currentTargetVerified: true, currentModelVerified: true });
  }

  return freeze({ bindOperation, bindReconstructionInput, readOperation, assertCurrentTarget });
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
  digest as digestMovieMentorProviderReconstructionInput,
  createMovieMentorProviderOperationAuthority,
  createMovieMentorProviderOperationBoundaryAuthority,
};

export default createMovieMentorProviderOperationAuthority;
