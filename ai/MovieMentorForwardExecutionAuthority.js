const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION = "1.2.0";
const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN = "iband.movie-mentor.forward-execution-authority";
const MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN = "iband.movie-mentor.forward-execution-proof";
const MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA = 1;

const s = (value) => (typeof value === "string" ? value.trim() : "");
const n = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
function fail(code, message, extras = {}) { const error = new Error(message); error.code = code; error.retryable = false; Object.assign(error, extras); throw error; }

function normalizeReacquisitionTarget({ projectId = null, creatorTurnId = null, executionId = null, leaseGeneration = null, leaseReference = null, fencingToken = null } = {}) {
  const target = Object.freeze({
    projectId: s(projectId), creatorTurnId: s(creatorTurnId), executionId: s(executionId),
    leaseGeneration: n(leaseGeneration), leaseReference: s(leaseReference), fencingToken: s(fencingToken),
  });
  if (!target.projectId || !target.creatorTurnId || !target.executionId || target.leaseGeneration === null || !target.leaseReference || !target.fencingToken) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_REACQUISITION_TARGET_REQUIRED", "Execution reacquisition requires the exact historical execution and lease universe before a successor lease may be minted.");
  }
  return target;
}

function normalizeCreationTarget({ projectId = null, principalId = null, creatorTurnId = null, executionId = null, reservationId = null, requestDigest = null, ownerId = null, leaseGeneration = null, leaseReference = null, fencingToken = null } = {}) {
  const target = Object.freeze({
    projectId: s(projectId), principalId: s(principalId), creatorTurnId: s(creatorTurnId), executionId: s(executionId),
    reservationId: s(reservationId), requestDigest: s(requestDigest), ownerId: s(ownerId), leaseGeneration: n(leaseGeneration),
    leaseReference: s(leaseReference), fencingToken: s(fencingToken),
  });
  if (!target.projectId || !target.principalId || !target.creatorTurnId || !target.executionId || !target.reservationId || !target.requestDigest || !target.ownerId || target.leaseGeneration !== 1 || !target.leaseReference || !target.fencingToken) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_CREATION_TARGET_REQUIRED", "Fresh execution creation requires the exact generation-one execution, reservation and lease universe before durable creation.");
  }
  return target;
}

function normalizeProviderCallAdmissionTarget(input = {}) {
  const target = Object.freeze({
    projectId: s(input.projectId), principalId: s(input.principalId), creatorTurnId: s(input.creatorTurnId), executionId: s(input.executionId),
    reservationId: s(input.reservationId), requestDigest: s(input.requestDigest), ownerId: s(input.ownerId), leaseGeneration: n(input.leaseGeneration),
    leaseReference: s(input.leaseReference), fencingToken: s(input.fencingToken), providerCallId: s(input.providerCallId),
    slotId: s(input.slotId), task: s(input.task), admittedAt: s(input.admittedAt),
  });
  if ([target.projectId, target.principalId, target.creatorTurnId, target.executionId, target.reservationId, target.requestDigest, target.ownerId, target.leaseReference, target.fencingToken, target.providerCallId, target.slotId, target.task, target.admittedAt].some((value) => !value) || target.leaseGeneration === null || target.leaseGeneration < 1) {
    fail("MOVIE_MENTOR_FORWARD_PROVIDER_CALL_TARGET_REQUIRED", "Provider-call admission requires the exact execution, lease, call and time universe before durable claim.");
  }
  return target;
}

function normalizeProviderEffectUnknownTarget(input = {}) {
  const base = normalizeProviderCallAdmissionTarget(input);
  const dispatchUnknownAt = s(input.dispatchUnknownAt);
  if (!dispatchUnknownAt) fail("MOVIE_MENTOR_FORWARD_PROVIDER_EFFECT_TARGET_REQUIRED", "Provider-effect UNKNOWN requires the exact dispatch-unknown time universe.");
  return Object.freeze({ ...base, dispatchUnknownAt });
}

function createMovieMentorForwardExecutionAuthority({ request = null, authorization = null, requestAuthority = null } = {}) {
  if (typeof requestAuthority?.authorize !== "function") fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", "Forward execution capability requires production creator request authority.");
  const principalId = s(authorization?.principalId), projectId = s(authorization?.projectId);
  const initialOwnershipRef = s(authorization?.ownershipRef), initialOwnershipRevision = n(authorization?.ownershipRevision);
  if (authorization?.authorized !== true || !principalId || !projectId || !initialOwnershipRef || initialOwnershipRevision === null || initialOwnershipRevision < 1) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", "Forward execution capability requires authenticated current project ownership at request admission.");
  }

  async function currentOwnership({ executionId = null, transition = null } = {}) {
    const current = await requestAuthority.authorize({ request, projectId });
    const currentOwnershipRef = s(current?.ownershipRef), currentOwnershipRevision = n(current?.ownershipRevision);
    if (current?.authorized !== true || s(current?.principalId) !== principalId || s(current?.projectId) !== projectId || !currentOwnershipRef || currentOwnershipRevision === null || currentOwnershipRevision < 1) {
      fail("MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED", "Current creator/project ownership is required before durable forward execution authority may advance.", { projectId, principalId, executionId: s(executionId) || null, transition: s(transition) || null });
    }
    if (currentOwnershipRef !== initialOwnershipRef || currentOwnershipRevision !== initialOwnershipRevision) {
      fail("MOVIE_MENTOR_FORWARD_EXECUTION_OWNERSHIP_CHANGED", "Forward execution authority cannot cross into a different ownership universe.", { executionId: s(executionId) || null, transition: s(transition) || null });
    }
    return Object.freeze({ ownershipRef: currentOwnershipRef, ownershipRevision: currentOwnershipRevision });
  }

  function proofFor(target, transition, current) {
    return Object.freeze({
      domain: MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN,
      schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA,
      authorized: true,
      currentOwnershipVerified: true,
      principalId,
      projectId,
      ownershipRef: current.ownershipRef,
      ownershipRevision: current.ownershipRevision,
      ...target,
      transition,
    });
  }

  async function assertCurrentReacquisition(targetInput = {}) {
    const target = normalizeReacquisitionTarget(targetInput);
    if (target.projectId !== projectId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Forward execution capability is bound to a different project.");
    const current = await currentOwnership({ executionId: target.executionId, transition: "execution-reacquisition" });
    return proofFor(target, "execution-reacquisition", current);
  }

  async function assertCurrentCreation(targetInput = {}) {
    const target = normalizeCreationTarget(targetInput);
    if (target.projectId !== projectId || target.principalId !== principalId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Fresh execution creation capability is bound to a different creator/project universe.");
    const current = await currentOwnership({ executionId: target.executionId, transition: "execution-creation" });
    return proofFor(target, "execution-creation", current);
  }

  async function assertCurrentProviderCallAdmission(targetInput = {}) {
    const target = normalizeProviderCallAdmissionTarget(targetInput);
    if (target.projectId !== projectId || target.principalId !== principalId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Provider-call admission capability is bound to a different creator/project universe.");
    const current = await currentOwnership({ executionId: target.executionId, transition: "provider-call-admission" });
    return proofFor(target, "provider-call-admission", current);
  }

  async function assertCurrentProviderEffectUnknown(targetInput = {}) {
    const target = normalizeProviderEffectUnknownTarget(targetInput);
    if (target.projectId !== projectId || target.principalId !== principalId) fail("MOVIE_MENTOR_FORWARD_EXECUTION_BINDING_INVALID", "Provider-effect UNKNOWN capability is bound to a different creator/project universe.");
    const current = await currentOwnership({ executionId: target.executionId, transition: "provider-effect-unknown" });
    return proofFor(target, "provider-effect-unknown", current);
  }

  return Object.freeze({
    version: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION,
    domain: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN,
    schema: MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA,
    principalId,
    projectId,
    assertCurrentReacquisition,
    assertCurrentCreation,
    assertCurrentProviderCallAdmission,
    assertCurrentProviderEffectUnknown,
  });
}

async function assertOwnedProof({ authority, target, method, transition, normalize }) {
  if (authority?.domain !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN || authority?.schema !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA || typeof authority?.[method] !== "function" || s(authority?.projectId) !== target.projectId || (target.principalId && s(authority?.principalId) !== target.principalId)) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_REQUIRED", `Forward execution transition ${transition} requires the exact server-created capability.`);
  }
  const proof = await authority[method](target);
  const normalized = normalize(proof);
  for (const [key, value] of Object.entries(target)) {
    if (normalized[key] !== value) fail("MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_INVALID", `Forward execution proof did not bind exact ${transition} field ${key}.`);
  }
  if (proof?.domain !== MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN || proof?.schema !== MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA || proof?.authorized !== true || proof?.currentOwnershipVerified !== true || s(proof?.principalId) !== s(authority.principalId) || s(proof?.projectId) !== target.projectId || proof?.transition !== transition) {
    fail("MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_INVALID", `Forward execution proof did not authorize exact ${transition} transition.`);
  }
  return proof;
}

async function assertMovieMentorForwardExecutionReacquisitionAuthority({ authority = null, ...targetInput } = {}) {
  const target = normalizeReacquisitionTarget(targetInput);
  return assertOwnedProof({ authority, target, method: "assertCurrentReacquisition", transition: "execution-reacquisition", normalize: normalizeReacquisitionTarget });
}

async function assertMovieMentorForwardExecutionCreationAuthority({ authority = null, ...targetInput } = {}) {
  const target = normalizeCreationTarget(targetInput);
  return assertOwnedProof({ authority, target, method: "assertCurrentCreation", transition: "execution-creation", normalize: normalizeCreationTarget });
}

async function assertMovieMentorForwardProviderCallAdmissionAuthority({ authority = null, ...targetInput } = {}) {
  const target = normalizeProviderCallAdmissionTarget(targetInput);
  return assertOwnedProof({ authority, target, method: "assertCurrentProviderCallAdmission", transition: "provider-call-admission", normalize: normalizeProviderCallAdmissionTarget });
}

async function assertMovieMentorForwardProviderEffectUnknownAuthority({ authority = null, ...targetInput } = {}) {
  const target = normalizeProviderEffectUnknownTarget(targetInput);
  return assertOwnedProof({ authority, target, method: "assertCurrentProviderEffectUnknown", transition: "provider-effect-unknown", normalize: normalizeProviderEffectUnknownTarget });
}

export {
  MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_VERSION,
  MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_FORWARD_EXECUTION_PROOF_DOMAIN,
  MOVIE_MENTOR_FORWARD_EXECUTION_AUTHORITY_SCHEMA,
  normalizeReacquisitionTarget,
  normalizeCreationTarget,
  normalizeProviderCallAdmissionTarget,
  normalizeProviderEffectUnknownTarget,
  createMovieMentorForwardExecutionAuthority,
  assertMovieMentorForwardExecutionReacquisitionAuthority,
  assertMovieMentorForwardExecutionCreationAuthority,
  assertMovieMentorForwardProviderCallAdmissionAuthority,
  assertMovieMentorForwardProviderEffectUnknownAuthority,
};
export default createMovieMentorForwardExecutionAuthority;
