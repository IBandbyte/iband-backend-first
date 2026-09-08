import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderEffectAuthority } from "../ai/MovieMentorProviderEffectAuthority.js";
import { createMovieMentorProviderOperationAuthority } from "../ai/MovieMentorProviderOperationAuthority.js";
import { retrieveMovieMentorProviderResponse } from "../ai/MovieMentorProviderRecoveryAdapter.js";
import { fingerprintMovieMentorProviderRoute } from "../ai/MovieMentorProviderTargetAuthority.js";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

let clock = new Date("2033-01-01T00:00:00.000Z");
let durable = null;
let id = 0;
const effectRows = new Map();
const operationRows = new Map();

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
    if (existing) {
      return { claimed: false, execution: clone(durable), existingProviderCall: clone(existing) };
    }
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
    return clone(effectRows.get(providerCallId) || null);
  },
  async beginUnknown(input) {
    const existing = effectRows.get(input.providerCallId);
    if (existing) return clone(existing);
    const row = {
      providerCallId: input.providerCallId,
      executionId: input.executionId,
      slotId: input.slotId,
      task: input.task,
      state: "unknown",
      dispatchUnknownAt: input.dispatchUnknownAt,
      revision: 0,
      evidence: [],
    };
    effectRows.set(input.providerCallId, row);
    return clone(row);
  },
  async appendEvidence(input) {
    const row = effectRows.get(input.providerCallId);
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
    return clone(operationRows.get(providerCallId) || null);
  },
  async bindOperation(input) {
    const existing = operationRows.get(input.providerCallId);
    if (existing) return clone(existing);
    operationRows.set(input.providerCallId, clone(input));
    return clone(input);
  },
};

const historicalTarget = Object.freeze({
  provider: "openai",
  adapter: "openai-responses",
  routeFingerprint: "a".repeat(64),
  recoveryMode: "known-response-id-retrieval",
});

const lease = createMovieMentorInferenceExecutionLeaseAuthority({
  store: executionStore,
  now: () => new Date(clock),
  leaseMs: 60_000,
  randomId: () => `recovery-${++id}`,
});
const effectAuthority = createMovieMentorProviderEffectAuthority({
  store: effectStore,
  now: () => new Date(clock),
});
const operationAuthority = createMovieMentorProviderOperationAuthority({
  store: operationStore,
  now: () => new Date(clock),
  resolveCurrentTarget: () => historicalTarget,
  resolveCurrentModel: () => "model-provider-outcome-recovery",
});

const execution = await lease.openExecution({
  creatorTurnId: "turn-provider-outcome-recovery",
  principalId: "creator-provider-outcome-recovery",
  projectId: "project-provider-outcome-recovery",
  reservationId: "reservation-provider-outcome-recovery",
  requestDigest: "digest-provider-outcome-recovery",
  ownerId: "owner-generation-one",
});
assert.equal(execution.authorized, true);

async function admitAndBegin(slotId, task) {
  const providerCall = await lease.claimProviderCall({ execution, slotId, task });
  assert.equal(providerCall.dispatchAuthorized, true);
  await operationAuthority.bindOperation({ providerCall });
  const unknown = await effectAuthority.beginDispatch({ providerCall });
  assert.equal(unknown.dispatchAuthorized, true);
  return providerCall;
}

const confirmedCall = await admitAndBegin("semantic", "movie-mentor-semantic");
await effectAuthority.contributeEvidence({
  providerCallId: confirmedCall.providerCallId,
  externalEffectId: "resp_confirmed_same_operation",
  provider: "openai",
  source: "provider-response",
});
const confirmedReality = await effectAuthority.readReality(confirmedCall.providerCallId);
assert.equal(confirmedReality.state, "confirmed");
assert.deepEqual(confirmedReality.evidence.map((entry) => entry.externalEffectId), ["resp_confirmed_same_operation"]);

const unknownCall = await admitAndBegin("synthesis", "movie-mentor-synthesis");
const unknownReality = await effectAuthority.readReality(unknownCall.providerCallId);
assert.equal(unknownReality.state, "unknown");
assert.equal(unknownReality.evidence.length, 0);

clock = new Date(clock.getTime() + 61_000);
const takeover = await lease.acquireExecution({ executionId: execution.executionId, ownerId: "owner-generation-two" });
assert.equal(takeover.authorized, true);
assert.equal(takeover.leaseGeneration, 2);

const replayClaim = await lease.claimProviderCall({
  execution: takeover,
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
assert.equal(replayClaim.dispatchAuthorized, false);
assert.equal(replayClaim.reason, "provider-call-slot-already-admitted");

console.log("✓ current lease law prevents takeover from re-buying the already admitted semantic slot");
console.log("✓ confirmed provider reality preserves exactly one trustworthy OpenAI response ID");
console.log("✓ Catastrophe B remains genuinely UNKNOWN with zero external response IDs");

const recoveryModule = await import("../ai/MovieMentorProviderOutcomeRecoveryAuthority.js");
assert.equal(
  typeof recoveryModule.createMovieMentorProviderOutcomeRecoveryAuthority,
  "function",
  "production needs a provider-outcome recovery authority that can distinguish recoverable confirmed same-operation evidence from true ID-less UNKNOWN without granting provider redispatch authority",
);

const recoveryCalls = [];
const recoveryAuthority = recoveryModule.createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: (providerCallId) => operationAuthority.readOperation(providerCallId),
  readProviderEffectReality: (providerCallId) => effectAuthority.readReality(providerCallId),
  resolveCurrentTarget: () => historicalTarget,
  recoverProviderResponse: async (request) => {
    recoveryCalls.push(clone(request));
    return {
      provider: "openai",
      externalEffectId: request.externalEffectId,
      response: { id: request.externalEffectId, status: "completed", output_text: "{}" },
    };
  },
});

const recovered = await recoveryAuthority.reconcile({ providerCallId: confirmedCall.providerCallId });
assert.equal(recovered.outcome, "CONFIRMED_EFFECT");
assert.equal(recovered.recoveryAuthorized, true);
assert.equal(recovered.recovered, true);
assert.equal(recovered.redispatchAuthorized, false);
assert.equal(recovered.refundAuthorized, false);
assert.equal(recovered.externalEffectId, "resp_confirmed_same_operation");
assert.equal(recoveryCalls.length, 1, "known-ID recovery should perform exactly one recovery-only provider request");
assert.equal(recoveryCalls[0].providerOperationId, confirmedCall.providerCallId);
assert.equal(recoveryCalls[0].externalEffectId, "resp_confirmed_same_operation");
assert.deepEqual(recoveryCalls[0].providerTarget, historicalTarget);
assert.equal(recoveryCalls[0].method, "retrieve-known-response-id");

const unresolved = await recoveryAuthority.reconcile({ providerCallId: unknownCall.providerCallId });
assert.equal(unresolved.outcome, "STILL_UNKNOWN");
assert.equal(unresolved.recoveryAuthorized, false);
assert.equal(unresolved.recovered, false);
assert.equal(unresolved.redispatchAuthorized, false);
assert.equal(unresolved.refundAuthorized, false);
assert.equal(recoveryCalls.length, 1, "ID-less UNKNOWN must perform zero recovery network calls");

const changedTarget = Object.freeze({ ...historicalTarget, routeFingerprint: "b".repeat(64) });
const changedTargetAuthority = recoveryModule.createMovieMentorProviderOutcomeRecoveryAuthority({
  readProviderOperation: (providerCallId) => operationAuthority.readOperation(providerCallId),
  readProviderEffectReality: (providerCallId) => effectAuthority.readReality(providerCallId),
  resolveCurrentTarget: () => changedTarget,
  recoverProviderResponse: async (request) => {
    recoveryCalls.push(clone(request));
    throw new Error("changed target must not reach recovery network");
  },
});
const targetMismatch = await changedTargetAuthority.reconcile({ providerCallId: confirmedCall.providerCallId });
assert.equal(targetMismatch.outcome, "CONFIRMED_EFFECT");
assert.equal(targetMismatch.recoveryAuthorized, false);
assert.equal(targetMismatch.recovered, false);
assert.equal(targetMismatch.reason, "provider-target-no-longer-current");
assert.equal(recoveryCalls.length, 1, "current provider target mismatch must block recovery before network");

const originalFetch = globalThis.fetch;
const envKeys = ["IBAND_AI_PROVIDER", "IBAND_AI_MODEL", "IBAND_AI_BASE_URL", "IBAND_AI_API_KEY", "OPENAI_API_KEY"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
try {
  process.env.IBAND_AI_PROVIDER = "openai";
  process.env.IBAND_AI_MODEL = "gpt-test";
  process.env.IBAND_AI_BASE_URL = "https://provider.example.test/v1/responses";
  process.env.IBAND_AI_API_KEY = "test-key";
  const configuredAdapterTarget = Object.freeze({
    provider: "openai",
    adapter: "openai-responses",
    routeFingerprint: fingerprintMovieMentorProviderRoute("openai", process.env.IBAND_AI_BASE_URL),
    recoveryMode: "known-response-id-retrieval",
  });
  let request = null;
  globalThis.fetch = async (url, options = {}) => {
    request = { url: String(url), options: clone(options) };
    return new Response(JSON.stringify({
      id: "resp_confirmed_same_operation",
      status: "completed",
      output_text: "{}",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const adapterResult = await retrieveMovieMentorProviderResponse({
    method: "retrieve-known-response-id",
    providerCallId: confirmedCall.providerCallId,
    providerOperationId: confirmedCall.providerCallId,
    executionId: execution.executionId,
    slotId: "semantic",
    task: "movie-mentor-semantic",
    externalEffectId: "resp_confirmed_same_operation",
    providerTarget: configuredAdapterTarget,
  });
  assert.equal(adapterResult.externalEffectId, "resp_confirmed_same_operation");
  assert.equal(adapterResult.providerOperationId, confirmedCall.providerCallId);
  assert.equal(request.options.method, "GET", "provider outcome recovery must use retrieval, not creative POST redispatch");
  assert.equal(request.url, "https://provider.example.test/v1/responses/resp_confirmed_same_operation");
  assert.equal(request.options.body, undefined, "response retrieval must not send a creative request body");
  assert.equal(request.options.headers["Idempotency-Key"], undefined, "recovery GET must not masquerade as idempotent creative POST replay");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

console.log("✓ confirmed known-ID provider work can enter a recovery-only same-operation path");
console.log("✓ true ID-less UNKNOWN remains STILL_UNKNOWN and never turns provider capability into redispatch authority");
console.log("✓ changed current provider target cannot impersonate historical recovery authority");
console.log("✓ OpenAI recovery adapter performs GET-by-known-response-ID with no creative body or redispatch idempotency header");
console.log("LAW: RECOVERY MAY OBSERVE THE SAME OPERATION. IT MAY NOT INVENT A SECOND OPERATION.");
console.log("LAW: NO PROVIDER RESPONSE ID MEANS NO KNOWN-ID RETRIEVAL REQUEST.");
console.log("Movie Mentor provider outcome recovery authority gate: GREEN");
