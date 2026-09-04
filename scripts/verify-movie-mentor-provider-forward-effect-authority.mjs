import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorForwardExecutionAuthority } from "../ai/MovieMentorForwardExecutionAuthority.js";
import { createForwardExecutionRuntimeDeps } from "../ai/MovieMentorForwardExecutionRuntime.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";
import { createMovieMentorProviderEffectAuthority } from "../ai/MovieMentorProviderEffectAuthority.js";

console.log("ROUND SEVEN — provider forward-effect authority torture");

const admitted = Object.freeze({
  authorized: true,
  principalId: "creator-1",
  projectId: "project-1",
  ownershipRef: "ownership:project-1",
  ownershipRevision: 1,
});

function fixture() {
  let durable = null;
  let effect = null;
  let claimWrites = 0;
  let unknownWrites = 0;
  let networkCalls = 0;
  let ownershipCurrent = true;
  let ids = 0;

  const executionStore = {
    async readExecution(id) { return durable?.executionId === id ? structuredClone(durable) : null; },
    async readExecutionByCreatorTurn({ creatorTurnId, principalId, projectId } = {}) {
      return durable && durable.creatorTurnId === creatorTurnId && durable.principalId === principalId && durable.projectId === projectId ? structuredClone(durable) : null;
    },
    async createExecution(next) { durable = structuredClone(next); return structuredClone(durable); },
    async replaceExecution(next) { durable = structuredClone(next); return structuredClone(durable); },
    async claimProviderCall(input = {}) {
      claimWrites += 1;
      if (!durable || durable.executionId !== input.executionId) return { claimed: false, execution: null };
      const existing = durable.providerCalls.find((call) => call.slotId === input.slotId) || null;
      if (existing) return { claimed: false, execution: structuredClone(durable), existingProviderCall: structuredClone(existing) };
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
      return { claimed: true, execution: structuredClone(durable), providerCall: structuredClone(call) };
    },
  };

  const effectStore = {
    async readEffect(providerCallId) { return effect?.providerCallId === providerCallId ? structuredClone(effect) : null; },
    async beginUnknown(input) {
      unknownWrites += 1;
      effect = {
        providerCallId: input.providerCallId,
        executionId: input.executionId,
        slotId: input.slotId,
        task: input.task,
        state: "unknown",
        dispatchUnknownAt: input.dispatchUnknownAt,
        evidence: [],
      };
      return structuredClone(effect);
    },
    async appendEvidence() { throw new Error("not used"); },
  };

  const lease = createMovieMentorInferenceExecutionLeaseAuthority({
    store: executionStore,
    now: () => new Date("2032-01-01T00:00:00.000Z"),
    randomId: () => `id-${++ids}`,
    requireProviderCallAuthority: true,
  });
  const effectAuthority = createMovieMentorProviderEffectAuthority({
    store: effectStore,
    now: () => new Date("2032-01-01T00:00:01.000Z"),
    requireUnknownAuthority: true,
  });
  const base = Object.freeze({ ...lease, beginProviderDispatch: effectAuthority.beginDispatch });
  const forward = createMovieMentorForwardExecutionAuthority({
    request: { id: "request-1" },
    authorization: admitted,
    requestAuthority: {
      async authorize() {
        return ownershipCurrent ? admitted : Object.freeze({ authorized: false, principalId: admitted.principalId, projectId: admitted.projectId });
      },
    },
  });
  const guarded = createForwardExecutionRuntimeDeps({ inferenceExecutionAuthority: base, forwardExecutionAuthority: forward }).inferenceExecutionAuthority;

  async function open(slotSuffix = "") {
    return guarded.openExecution({
      creatorTurnId: `turn-1${slotSuffix}`,
      principalId: admitted.principalId,
      projectId: admitted.projectId,
      reservationId: `reservation-1${slotSuffix}`,
      requestDigest: `digest-1${slotSuffix}`,
      ownerId: "owner-1",
    });
  }

  return {
    guarded,
    open,
    setOwnership(value) { ownershipCurrent = value; },
    counts() { return { claimWrites, unknownWrites, networkCalls }; },
    network() { networkCalls += 1; },
  };
}

// Race A: live execution exists, then ownership is revoked before provider-call admission.
{
  const f = fixture();
  const execution = await f.open();
  f.setOwnership(false);
  await assert.rejects(
    () => f.guarded.claimProviderCall({ execution, slotId: "semantic", task: "movie-mentor-semantic" }),
    (error) => error.code === "MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED",
  );
  assert.deepEqual(f.counts(), { claimWrites: 0, unknownWrites: 0, networkCalls: 0 });
}

// Race B: claim is legitimately admitted, then ownership is revoked before durable UNKNOWN.
{
  const f = fixture();
  const execution = await f.open();
  const providerCall = await f.guarded.claimProviderCall({ execution, slotId: "semantic", task: "movie-mentor-semantic" });
  assert.equal(providerCall.dispatchAuthorized, true);
  assert.equal(f.counts().claimWrites, 1);
  f.setOwnership(false);
  await assert.rejects(
    () => f.guarded.beginProviderDispatch({ providerCall }),
    (error) => error.code === "MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED",
  );
  assert.deepEqual(f.counts(), { claimWrites: 1, unknownWrites: 0, networkCalls: 0 });
}

// Positive control: each transition independently re-earns current ownership.
{
  const f = fixture();
  const execution = await f.open();
  const providerCall = await f.guarded.claimProviderCall({ execution, slotId: "semantic", task: "movie-mentor-semantic" });
  const dispatch = await f.guarded.beginProviderDispatch({ providerCall });
  assert.equal(dispatch.dispatchAuthorized, true);
  f.network();
  assert.deepEqual(f.counts(), { claimWrites: 1, unknownWrites: 1, networkCalls: 1 });
}

// Mutation owners reject decorative or forged neighbour proofs before writes.
{
  let claimWrites = 0;
  let durable = null;
  const store = {
    readExecution: async () => structuredClone(durable),
    readExecutionByCreatorTurn: async () => structuredClone(durable),
    createExecution: async (next) => (durable = structuredClone(next)),
    replaceExecution: async (next) => (durable = structuredClone(next)),
    claimProviderCall: async () => { claimWrites += 1; return { claimed: false, execution: durable }; },
  };
  const lease = createMovieMentorInferenceExecutionLeaseAuthority({ store, now: () => new Date("2032-01-01T00:00:00.000Z"), randomId: (() => { let n = 0; return () => `forge-${++n}`; })(), requireProviderCallAuthority: true });
  const execution = await lease.openExecution({ creatorTurnId: "turn-f", principalId: "creator-1", projectId: "project-1", reservationId: "reservation-f", requestDigest: "digest-f", ownerId: "owner-f" });
  await assert.rejects(
    () => lease.claimProviderCall({
      execution,
      slotId: "semantic",
      task: "movie-mentor-semantic",
      assertCurrentProviderCallAdmissionAuthority: async (target) => ({ ...target, authorized: true, currentOwnershipVerified: true, transition: "provider-call-admission", providerCallId: "forged-call" }),
    }),
    (error) => error.code === "MOVIE_MENTOR_INFERENCE_PROVIDER_CALL_CURRENT_OWNERSHIP_INVALID",
  );
  assert.equal(claimWrites, 0);

  let unknownWrites = 0;
  const effectAuthority = createMovieMentorProviderEffectAuthority({
    store: { readEffect: async () => null, beginUnknown: async () => { unknownWrites += 1; return null; }, appendEvidence: async () => null },
    now: () => new Date("2032-01-01T00:00:01.000Z"),
    requireUnknownAuthority: true,
  });
  const providerCall = {
    authorized: true, dispatchAuthorized: true, projectId: "project-1", principalId: "creator-1", creatorTurnId: "turn-f", reservationId: "reservation-f", requestDigest: "digest-f",
    providerCallId: "call-f", executionId: execution.executionId, slotId: "semantic", task: "movie-mentor-semantic", ownerId: execution.ownerId,
    leaseGeneration: execution.leaseGeneration, leaseReference: execution.leaseReference, fencingToken: execution.fencingToken, admittedAt: "2032-01-01T00:00:00.000Z",
  };
  await assert.rejects(
    () => effectAuthority.beginDispatch({
      providerCall,
      assertCurrentProviderEffectUnknownAuthority: async (target) => ({ ...target, authorized: true, currentOwnershipVerified: true, transition: "provider-effect-unknown", executionId: "forged-execution" }),
    }),
    (error) => error.code === "MOVIE_MENTOR_PROVIDER_EFFECT_CURRENT_OWNERSHIP_INVALID",
  );
  assert.equal(unknownWrites, 0);
}

const leaseSource = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionLeaseAuthority.js", import.meta.url), "utf8");
const effectSource = fs.readFileSync(new URL("../ai/MovieMentorProviderEffectAuthority.js", import.meta.url), "utf8");
const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorForwardExecutionRuntime.js", import.meta.url), "utf8");
const productionSource = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js", import.meta.url), "utf8");
assert.ok(leaseSource.indexOf("assertCurrentProviderCallAdmissionAuthority(candidate)") < leaseSource.indexOf("store.claimProviderCall({"));
assert.ok(effectSource.indexOf("assertCurrentProviderEffectUnknownAuthority(binding)") < effectSource.indexOf("store.beginUnknown(binding)"));
assert.match(runtimeSource, /assertMovieMentorForwardProviderCallAdmissionAuthority/);
assert.match(runtimeSource, /assertMovieMentorForwardProviderEffectUnknownAuthority/);
assert.match(productionSource, /requireProviderCallAuthority:true/);
assert.match(productionSource, /requireUnknownAuthority:true/);
assert.match(productionSource, /providerCallAdmissionCurrentOwnershipRequired:true/);
assert.match(productionSource, /providerEffectUnknownCurrentOwnershipRequired:true/);

console.log("✅ Provider forward-effect authority verified: revoked ownership cannot durably admit a provider call or mint UNKNOWN effect reality.");
console.log("🧭 Law: CAPABILITY MAY SURVIVE. PROOF MAY NOT. EACH IRREVERSIBLE FORWARD-EFFECT TRANSITION RE-EARNS CURRENT CREATOR/PROJECT AUTHORITY.");
