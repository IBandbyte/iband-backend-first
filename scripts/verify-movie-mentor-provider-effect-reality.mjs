import assert from "node:assert/strict";
import { createMovieMentorProviderEffectAuthority } from "../ai/MovieMentorProviderEffectAuthority.js";
import { createFencedInferenceOrchestrationDeps } from "../ai/MovieMentorTurnRuntime.js";

const clone = (value) => (value == null ? value : structuredClone(value));
let clock = new Date("2031-01-01T00:00:00.000Z");
const records = new Map();
let loseEvidenceAck = false;

const store = {
  async readEffect(id) {
    return clone(records.get(id) || null);
  },
  async beginUnknown(input) {
    const existing = records.get(input.providerCallId);
    if (existing) return clone(existing);
    const next = { ...clone(input), state: "unknown", evidence: [] };
    records.set(input.providerCallId, next);
    return clone(next);
  },
  async appendEvidence(input) {
    const current = records.get(input.providerCallId);
    if (!current) return null;
    if (current.evidence.some((item) => item.externalEffectId === input.externalEffectId)) return clone(current);
    current.evidence.push({
      externalEffectId: input.externalEffectId,
      provider: input.provider,
      observedAt: input.observedAt,
      source: input.source,
    });
    current.state = current.evidence.length === 1 ? "confirmed" : "conflict";
    records.set(input.providerCallId, current);
    if (loseEvidenceAck) {
      loseEvidenceAck = false;
      throw new Error("simulated evidence ACK loss");
    }
    return clone(current);
  },
};

const effect = createMovieMentorProviderEffectAuthority({ store, now: () => new Date(clock) });
const call = (id) => ({
  authorized: true,
  dispatchAuthorized: true,
  principalId: "creator-1",
  projectId: "project-1",
  creatorTurnId: "turn-1",
  reservationId: "reservation-1",
  requestDigest: "digest-1",
  providerCallId: id,
  executionId: "execution-1",
  slotId: id,
  task: `task:${id}`,
  ownerId: "worker-1",
  leaseGeneration: 1,
  leaseReference: "lease-1",
  fencingToken: "fence-1",
  admittedAt: "2031-01-01T00:00:00.000Z",
});

function successfulInputBinding(providerCall, reconstructionInput, trace = null) {
  if (trace) trace.push([providerCall.providerCallId, "input-bound", clone(reconstructionInput)]);
  return {
    authorized: true,
    inputBound: true,
    providerCallId: providerCall.providerCallId,
    reconstructionInputDigest: `digest:${providerCall.providerCallId}`,
  };
}

console.log("5A.24 Round Three — Provider Effect Reality + UNKNOWN Preservation catastrophe torture");

assert.throws(
  () => createFencedInferenceOrchestrationDeps({
    execution: { authorized: true },
    inferenceExecutionAuthority: { claimProviderCall: async () => call("missing-effect-capability") },
  }),
  (error) => error.code === "MOVIE_MENTOR_PROVIDER_EFFECT_AUTHORITY_REQUIRED",
);

const deniedTrace = [];
let providerInvoked = false;
const denied = createFencedInferenceOrchestrationDeps({
  execution: { authorized: true },
  inferenceExecutionAuthority: {
    async claimProviderCall() {
      return call("semantic-denied");
    },
    async bindProviderReconstructionInput({ providerCall, reconstructionInput }) {
      return successfulInputBinding(providerCall, reconstructionInput, deniedTrace);
    },
    async beginProviderDispatch({ providerCall }) {
      deniedTrace.push([providerCall.providerCallId, "begin-unknown"]);
      throw Object.assign(new Error("durable UNKNOWN failed"), { code: "UNKNOWN_WRITE_FAILED" });
    },
    async assertProviderDispatch() {
      return { dispatchAuthorized: true };
    },
    async contributeProviderEffectEvidence() {
      return { accepted: true };
    },
  },
  deps: {
    interpretSemantics: async () => {
      providerInvoked = true;
      return {};
    },
  },
});
await assert.rejects(() => denied.interpretSemantics({ universe: "denied-input-A" }), (error) => error.code === "UNKNOWN_WRITE_FAILED");
assert.equal(providerInvoked, false);
assert.deepEqual(
  deniedTrace.map((entry) => entry.slice(0, 2)),
  [["semantic-denied", "input-bound"], ["semantic-denied", "begin-unknown"]],
  "historical task input must be bound before the Provider Effect Reality court attempts durable UNKNOWN",
);

const staleTrace = [];
let staleProviderInvoked = false;
const stale = createFencedInferenceOrchestrationDeps({
  execution: { authorized: true },
  inferenceExecutionAuthority: {
    async claimProviderCall() {
      return call("semantic-stale");
    },
    async bindProviderReconstructionInput({ providerCall, reconstructionInput }) {
      return successfulInputBinding(providerCall, reconstructionInput, staleTrace);
    },
    async beginProviderDispatch({ providerCall }) {
      staleTrace.push([providerCall.providerCallId, "unknown"]);
      return { dispatchAuthorized: true, effectState: "unknown" };
    },
    async assertProviderDispatch({ providerCall }) {
      staleTrace.push([providerCall.providerCallId, "fence-denied"]);
      return { dispatchAuthorized: false, reason: "execution-generation-fenced" };
    },
    async contributeProviderEffectEvidence() {
      return { accepted: true };
    },
  },
  deps: {
    interpretSemantics: async () => {
      staleProviderInvoked = true;
      return {};
    },
  },
});
await assert.rejects(
  () => stale.interpretSemantics({ universe: "stale-input-A" }),
  (error) => error.code === "MOVIE_MENTOR_INFERENCE_PROVIDER_DISPATCH_FENCED",
);
assert.equal(staleProviderInvoked, false);
assert.deepEqual(
  staleTrace.map((entry) => entry.slice(0, 2)),
  [["semantic-stale", "input-bound"], ["semantic-stale", "unknown"], ["semantic-stale", "fence-denied"]],
  "input binding must precede UNKNOWN, and a revoked execution fence must still stop the provider socket",
);

const unknown = await effect.beginDispatch({ providerCall: call("call-timeout") });
assert.equal(unknown.effectState, "unknown");
await assert.rejects(async () => {
  throw new Error("transport died during POST");
});
clock = new Date(clock.getTime() + 86_400_000);
assert.equal((await effect.readReality("call-timeout")).state, "unknown");

const confirmedCall = call("call-confirmed");
await effect.beginDispatch({ providerCall: confirmedCall });
loseEvidenceAck = true;
const ackLost = await effect.contributeEvidence({
  providerCallId: "call-confirmed",
  externalEffectId: "resp_123",
  provider: "openai",
});
assert.equal(ackLost.state, "confirmed");
assert.equal(ackLost.externalEffectIds[0], "resp_123");
const replay = await effect.contributeEvidence({
  providerCallId: "call-confirmed",
  externalEffectId: "resp_123",
  provider: "openai",
});
assert.equal(replay.idempotent, true);
assert.equal(replay.state, "confirmed");
const conflict = await effect.contributeEvidence({
  providerCallId: "call-confirmed",
  externalEffectId: "resp_999",
  provider: "openai",
  source: "late-stale-worker-response",
});
assert.equal(conflict.state, "conflict");
assert.deepEqual(new Set(conflict.externalEffectIds), new Set(["resp_123", "resp_999"]));

const runtimeRecords = [];
let runtimeProviderCalls = 0;
const runtimeAuthority = {
  async claimProviderCall({ slotId, task }) {
    return { ...call(`runtime-${slotId}`), slotId, task };
  },
  async bindProviderReconstructionInput({ providerCall, reconstructionInput }) {
    return successfulInputBinding(providerCall, reconstructionInput, runtimeRecords);
  },
  async beginProviderDispatch({ providerCall }) {
    runtimeRecords.push([providerCall.providerCallId, "unknown"]);
    return { dispatchAuthorized: true, effectState: "unknown" };
  },
  async assertProviderDispatch({ providerCall }) {
    runtimeRecords.push([providerCall.providerCallId, "fresh-fence"]);
    return { dispatchAuthorized: true };
  },
  async contributeProviderEffectEvidence(input) {
    runtimeRecords.push([input.providerCallId, "confirmed", input.externalEffectId]);
    return { accepted: true, state: "confirmed" };
  },
};
const fenced = createFencedInferenceOrchestrationDeps({
  execution: { authorized: true },
  inferenceExecutionAuthority: runtimeAuthority,
  deps: {
    interpretSemantics: async () => {
      runtimeProviderCalls += 1;
      return { providerMetadata: { provider: "openai", responseId: "resp_live" } };
    },
  },
});
const runtimeInput = { universe: "runtime-input-A" };
await fenced.interpretSemantics(runtimeInput);
assert.equal(runtimeProviderCalls, 1);
assert.deepEqual(runtimeRecords, [
  ["runtime-semantic", "input-bound", runtimeInput],
  ["runtime-semantic", "unknown"],
  ["runtime-semantic", "fresh-fence"],
  ["runtime-semantic", "confirmed", "resp_live"],
]);

const lostResponseRecords = [];
const lostResponseAuthority = {
  async claimProviderCall({ slotId, task }) {
    return { ...call(`lost-${slotId}`), slotId, task };
  },
  async bindProviderReconstructionInput({ providerCall, reconstructionInput }) {
    return successfulInputBinding(providerCall, reconstructionInput, lostResponseRecords);
  },
  async beginProviderDispatch({ providerCall }) {
    lostResponseRecords.push([providerCall.providerCallId, "unknown"]);
    await effect.beginDispatch({ providerCall });
    return { dispatchAuthorized: true };
  },
  async assertProviderDispatch({ providerCall }) {
    lostResponseRecords.push([providerCall.providerCallId, "fresh-fence"]);
    return { dispatchAuthorized: true };
  },
  async contributeProviderEffectEvidence() {
    throw new Error("must not invent evidence");
  },
};
const lost = createFencedInferenceOrchestrationDeps({
  execution: { authorized: true },
  inferenceExecutionAuthority: lostResponseAuthority,
  deps: {
    interpretSemantics: async () => {
      throw new Error("provider response lost after dispatch");
    },
  },
});
const lostInput = { universe: "lost-response-input-A" };
await assert.rejects(() => lost.interpretSemantics(lostInput));
assert.equal((await effect.readReality("lost-semantic")).state, "unknown");
assert.deepEqual(lostResponseRecords, [
  ["lost-semantic", "input-bound", lostInput],
  ["lost-semantic", "unknown"],
  ["lost-semantic", "fresh-fence"],
]);

console.log("✓ missing UNKNOWN/fresh-fence/evidence capability -> no orchestration authority");
console.log("✓ exact historical task input binds before every reachable UNKNOWN transition");
console.log("✓ death before POST: historical input bound, durable UNKNOWN fails -> no provider invocation");
console.log("✓ fence revocation after historical input + UNKNOWN but before POST -> no provider invocation");
console.log("✓ death during POST preserves UNKNOWN");
console.log("✓ lost provider response preserves UNKNOWN");
console.log("✓ lost evidence-write ACK rereads durable CONFIRMED reality");
console.log("✓ same external evidence replay is idempotent");
console.log("✓ conflicting external effect IDs are preserved as CONFLICT");
console.log("✓ stale worker may contribute evidence without receiving forward authority");
console.log("✓ time passage cannot manufacture RELEASED from UNKNOWN");
console.log("LAW: HISTORICAL TASK INPUT MUST BE DURABLY BOUND BEFORE UNKNOWN.");
console.log("LAW: UNKNOWN BEFORE NETWORK AND FRESH DISPATCH FENCE REMAIN MANDATORY CAPABILITIES, NOT OPTIONAL ENHANCEMENTS.");
console.log("5A.24 Round Three catastrophe torture: GREEN");
