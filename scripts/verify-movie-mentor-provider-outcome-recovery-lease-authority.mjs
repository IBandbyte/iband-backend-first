import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderEffectAuthority } from "../ai/MovieMentorProviderEffectAuthority.js";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { createMovieMentorProviderOutcomeRecoveryAuthority } from "../ai/MovieMentorProviderOutcomeRecoveryAuthority.js";

const clone = (value) => value == null ? value : structuredClone(value);
let clock = new Date("2034-01-01T00:00:00.000Z");
let durable = null;
let nonce = 0;
const effects = new Map();
const operations = new Map();

const executionStore = {
  async readExecution(executionId) {
    return durable?.executionId === executionId ? clone(durable) : null;
  },
  async readExecutionByCreatorTurn({ creatorTurnId, principalId, projectId } = {}) {
    return durable
      && durable.creatorTurnId === creatorTurnId
      && durable.principalId === principalId
      && durable.projectId === projectId
      ? clone(durable)
      : null;
  },
  async createExecution(next) {
    durable = clone(next);
    return clone(durable);
  },
  async replaceExecution(next, expected = {}) {
    if (!durable || durable.executionId !== next.executionId) return null;
    if (expected.expectedPhase && durable.phase !== expected.expectedPhase) return null;
    if (Number.isSafeInteger(expected.expectedLeaseGeneration) && durable.leaseGeneration !== expected.expectedLeaseGeneration) return null;
    if (expected.expectedLeaseReference && durable.leaseReference !== expected.expectedLeaseReference) return null;
    durable = clone(next);
    return clone(durable);
  },
  async claimProviderCall(input = {}) {
    if (!durable || durable.executionId !== input.executionId) return { claimed: false, execution: null };
    const existing = durable.providerCalls.find((call) => call.slotId === input.slotId) || null;
    if (existing) return { claimed: false, execution: clone(durable), existingProviderCall: clone(existing) };
    const call = {
      providerCallId: input.providerCallId,
      slotId: input.slotId,
      task: input.task,
      state: "admitted",
      leaseGeneration: input.leaseGeneration,
      leaseReference: input.leaseReference,
      fencingToken: input.fencingToken,
      admittedAt: input.admittedAt,
    };
    durable.providerCalls.push(call);
    durable.providerCallsClaimed = durable.providerCalls.length;
    return { claimed: true, execution: clone(durable), providerCall: clone(call) };
  },
};

const effectStore = {
  async readEffect(providerCallId) {
    return clone(effects.get(providerCallId) || null);
  },
  async beginUnknown(input) {
    const row = effects.get(input.providerCallId) || {
      providerCallId: input.providerCallId,
      executionId: input.executionId,
      slotId: input.slotId,
      task: input.task,
      state: "unknown",
      dispatchUnknownAt: input.dispatchUnknownAt,
      revision: 0,
      evidence: [],
    };
    effects.set(input.providerCallId, row);
    return clone(row);
  },
  async appendEvidence(input) {
    const row = effects.get(input.providerCallId);
    if (!row) return null;
    if (!row.evidence.some((entry) => entry.externalEffectId === input.externalEffectId)) {
      row.evidence.push({
        externalEffectId: input.externalEffectId,
        provider: input.provider,
        observedAt: input.observedAt,
        source: input.source,
      });
      row.revision += 1;
      row.state = row.evidence.length === 1 ? "confirmed" : "conflict";
    }
    return clone(row);
  },
};

const operationStore = {
  async readOperation(providerCallId) {
    return clone(operations.get(providerCallId) || null);
  },
  async bindOperation(input) {
    const current = operations.get(input.providerCallId);
    if (current) return clone(current);
    operations.set(input.providerCallId, clone(input));
    return clone(input);
  },
};

const providerTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "c".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});

const leaseAuthority = createMovieMentorInferenceExecutionLeaseAuthority({
  store: executionStore,
  now: () => new Date(clock),
  leaseMs: 60_000,
  randomId: () => `lease-recovery-${++nonce}`,
});
const effectAuthority = createMovieMentorProviderEffectAuthority({ store: effectStore, now: () => new Date(clock) });
const operationAuthority = createMovieMentorProviderOperationAuthority({
  store: operationStore,
  now: () => new Date(clock),
  resolveCurrentTarget: () => providerTarget,
});

const generationOne = await leaseAuthority.openExecution({
  creatorTurnId: "turn-recovery-lease-proof",
  principalId: "creator-recovery-lease-proof",
  projectId: "project-recovery-lease-proof",
  reservationId: "reservation-recovery-lease-proof",
  requestDigest: "digest-recovery-lease-proof",
  ownerId: "worker-generation-one",
});
assert.equal(generationOne.authorized, true);

const providerCall = await leaseAuthority.claimProviderCall({
  execution: generationOne,
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
assert.equal(providerCall.dispatchAuthorized, true);
await operationAuthority.bindOperation({ providerCall });
await effectAuthority.beginDispatch({ providerCall });
await effectAuthority.contributeEvidence({
  providerCallId: providerCall.providerCallId,
  externalEffectId: "resp_recovery_lease_proof",
  provider: "openai",
  source: "provider-response",
});
assert.equal((await effectAuthority.readReality(providerCall.providerCallId)).state, "confirmed");

clock = new Date(clock.getTime() + 61_000);
const generationTwo = await leaseAuthority.acquireExecution({
  executionId: generationOne.executionId,
  ownerId: "worker-generation-two",
});
assert.equal(generationTwo.authorized, true);
assert.equal(generationTwo.leaseGeneration, 2);
assert.equal((await leaseAuthority.assertFence(generationOne)).authorized, false, "generation-one execution proof must be stale after takeover");
assert.equal((await leaseAuthority.assertFence(generationTwo)).authorized, true, "generation-two takeover must own current execution authority");

let recoveryCalls = 0;
const recoveryAuthority = createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: (providerCallId) => operationAuthority.readOperation(providerCallId),
  readProviderEffectReality: (providerCallId) => effectAuthority.readReality(providerCallId),
  resolveCurrentTarget: () => providerTarget,
  requireRecoveryAuthority: true,
  assertCurrentRecoveryAuthority: async ({ operation, recoveryAuthority: executionProof }) => {
    const current = await leaseAuthority.assertFence(executionProof);
    if (current?.authorized !== true || current?.executionAuthorized !== true) {
      return { authorized: false, currentRecoveryAuthorityVerified: false, reason: current?.reason || "execution-recovery-fenced" };
    }
    if (current.executionId !== operation.executionId) {
      return { authorized: false, currentRecoveryAuthorityVerified: false, reason: "execution-recovery-binding-conflict" };
    }
    return {
      authorized: true,
      currentRecoveryAuthorityVerified: true,
      transition: "provider-outcome-recovery",
      executionId: current.executionId,
      providerCallId: operation.providerCallId,
      ownerId: current.ownerId,
      leaseGeneration: current.leaseGeneration,
      leaseReference: current.leaseReference,
      fencingToken: current.fencingToken,
    };
  },
  recoverProviderResponse: async (request) => {
    recoveryCalls += 1;
    return {
      provider: "openai",
      externalEffectId: request.externalEffectId,
      response: { id: request.externalEffectId, status: "completed", output_text: "{}" },
    };
  },
});

const stale = await recoveryAuthority.reconcile({
  providerCallId: providerCall.providerCallId,
  recoveryAuthority: generationOne,
});
assert.equal(stale.outcome, "CONFIRMED_EFFECT");
assert.equal(stale.recoveryAuthorized, false, "stale generation must not retain provider recovery network authority");
assert.equal(stale.recovered, false);
assert.equal(stale.reason, "provider-recovery-execution-fenced");
assert.equal(recoveryCalls, 0, "stale generation must be fenced before any provider recovery request");

const missing = await recoveryAuthority.reconcile({ providerCallId: providerCall.providerCallId });
assert.equal(missing.recoveryAuthorized, false, "production recovery must fail closed when no current execution proof is supplied");
assert.equal(missing.reason, "provider-recovery-authority-required");
assert.equal(recoveryCalls, 0);

const current = await recoveryAuthority.reconcile({
  providerCallId: providerCall.providerCallId,
  recoveryAuthority: generationTwo,
});
assert.equal(current.outcome, "CONFIRMED_EFFECT");
assert.equal(current.recoveryAuthorized, true);
assert.equal(current.recovered, true);
assert.equal(current.recoveryLeaseGeneration, 2);
assert.equal(current.recoveryOwnerId, "worker-generation-two");
assert.equal(current.redispatchAuthorized, false);
assert.equal(current.refundAuthorized, false);
assert.equal(recoveryCalls, 1, "only the current execution generation may perform the recovery-only provider request");

console.log("✓ stale execution generation is fenced before provider recovery network activity");
console.log("✓ missing recovery lease proof fails closed before provider recovery network activity");
console.log("✓ current takeover generation may recover the same historical provider operation without gaining redispatch authority");
console.log("LAW: HISTORICAL PROVIDER IDENTITY MAY SURVIVE TAKEOVER. RECOVERY NETWORK AUTHORITY MAY NOT.");
console.log("Movie Mentor provider outcome recovery lease authority gate: GREEN");
