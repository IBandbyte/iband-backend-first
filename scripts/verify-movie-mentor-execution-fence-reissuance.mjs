import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const clone = (value) => value == null ? value : structuredClone(value);
let durable = null;
let id = 0;
const now = () => new Date("2031-01-01T00:00:00.000Z");

const store = {
  async readExecution(executionId) {
    return durable?.executionId === executionId ? clone(durable) : null;
  },
  async readExecutionByCreatorTurn({ principalId, projectId, creatorTurnId } = {}) {
    return durable
      && durable.principalId === principalId
      && durable.projectId === projectId
      && durable.creatorTurnId === creatorTurnId
      ? clone(durable)
      : null;
  },
  async createExecution(next) {
    if (durable) return null;
    durable = clone(next);
    return clone(durable);
  },
  async replaceExecution(next) {
    durable = clone(next);
    return clone(durable);
  },
  async claimProviderCall(input = {}) {
    if (!durable || durable.executionId !== input.executionId) return { claimed: false, execution: null };
    const existing = durable.providerCalls.find((call) => call.slotId === input.slotId) || null;
    const live = durable.phase === "active"
      && durable.ownerId === input.ownerId
      && durable.leaseGeneration === input.leaseGeneration
      && durable.leaseReference === input.leaseReference
      && durable.fencingToken === input.fencingToken
      && new Date(durable.leaseExpiresAt) > new Date(input.admittedAt);
    if (existing || !live) return { claimed: false, execution: clone(durable), existingProviderCall: clone(existing) };
    const providerCall = {
      providerCallId: input.providerCallId,
      slotId: input.slotId,
      task: input.task,
      leaseGeneration: input.leaseGeneration,
      leaseReference: input.leaseReference,
      fencingToken: input.fencingToken,
      admittedAt: input.admittedAt,
    };
    durable.providerCalls.push(providerCall);
    durable.providerCallsClaimed += 1;
    return { claimed: true, execution: clone(durable), providerCall: clone(providerCall) };
  },
};

const authority = createMovieMentorInferenceExecutionLeaseAuthority({
  store,
  now,
  leaseMs: 60_000,
  maxProviderCalls: 5,
  randomId: () => `fence-gate-${++id}`,
});

const genuine = await authority.openExecution({
  creatorTurnId: "turn-fence-gate",
  principalId: "creator-fence-gate",
  projectId: "project-fence-gate",
  reservationId: "reservation-fence-gate",
  requestDigest: "digest-fence-gate",
  ownerId: "worker-fence-gate",
  maxProviderCalls: 5,
});
assert.equal(genuine.authorized, true);

const genuineRevalidated = await authority.assertFence(genuine);
assert.equal(genuineRevalidated.authorized, true, "genuine owner-issued execution evidence must survive current durable fence revalidation");
const genuineClaim = await authority.claimProviderCall({
  execution: genuineRevalidated,
  slotId: "genuine-slot",
  task: "movie-mentor-semantic",
});
assert.equal(genuineClaim.dispatchAuthorized, true, "genuine revalidated owner proof must retain provider-call authority");

const reconstructedFence = Object.freeze({
  executionId: genuine.executionId,
  ownerId: genuine.ownerId,
  leaseGeneration: genuine.leaseGeneration,
  leaseReference: genuine.leaseReference,
  fencingToken: genuine.fencingToken,
});

let reconstructedEscaped = false;
const reconstructedRevalidated = await authority.assertFence(reconstructedFence);
if (reconstructedRevalidated?.authorized === true) {
  try {
    const decision = await authority.claimProviderCall({
      execution: reconstructedRevalidated,
      slotId: "reconstructed-slot",
      task: "movie-mentor-synthesis",
    });
    reconstructedEscaped = decision?.dispatchAuthorized === true;
  } catch (error) {
    assert.equal(error?.code, "MOVIE_MENTOR_INFERENCE_EXECUTION_OWNER_PROOF_REQUIRED");
  }
}
assert.equal(
  reconstructedEscaped,
  false,
  "a structurally reconstructed durable fence tuple must not be laundered by assertFence into fresh provider-call owner authority",
);

const secondAuthority = createMovieMentorInferenceExecutionLeaseAuthority({
  store,
  now,
  leaseMs: 60_000,
  maxProviderCalls: 5,
  randomId: () => `second-fence-gate-${++id}`,
});
let crossAuthorityEscaped = false;
const crossAuthorityRevalidated = await secondAuthority.assertFence(reconstructedFence);
if (crossAuthorityRevalidated?.authorized === true) {
  try {
    const decision = await secondAuthority.claimProviderCall({
      execution: crossAuthorityRevalidated,
      slotId: "cross-authority-slot",
      task: "movie-mentor-specialist:story",
    });
    crossAuthorityEscaped = decision?.dispatchAuthorized === true;
  } catch (error) {
    assert.equal(error?.code, "MOVIE_MENTOR_INFERENCE_EXECUTION_OWNER_PROOF_REQUIRED");
  }
}
assert.equal(
  crossAuthorityEscaped,
  false,
  "durable fence fields learned from another issuer must not mint fresh forward authority in a new authority instance",
);

console.log("✓ genuine owner-issued execution evidence may be revalidated under the current durable fence");
console.log("✓ reconstructed fence tuples receive zero fresh provider-call owner authority");
console.log("✓ fence tuples cannot teleport owner proof across authority instances");
console.log("LAW: OWNER-ISSUED EXECUTION PROOF + CURRENT DURABLE FENCE → REVALIDATED OWNER PROOF → PROVIDER-CALL CLAIM");
console.log("LAW: DURABLE FENCE FACTS WITHOUT OWNER PROVENANCE → ZERO FRESH FORWARD AUTHORITY");
console.log("Zorg: But all five fence fields match. Kraken: FACTS ARE NOT ISSUER PROVENANCE, ZORG.");
console.log("Gates of Execution fence reissuance torture: GREEN");
