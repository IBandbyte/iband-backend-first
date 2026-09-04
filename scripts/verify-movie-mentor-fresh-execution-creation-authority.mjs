import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorForwardExecutionAuthority } from "../ai/MovieMentorForwardExecutionAuthority.js";
import { createForwardExecutionRuntimeDeps } from "../ai/MovieMentorForwardExecutionRuntime.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

console.log("ROUND SEVEN — fresh execution creation current-ownership torture");

const binding = Object.freeze({
  creatorTurnId: "turn-create-1",
  principalId: "creator-create-1",
  projectId: "project-create-1",
  reservationId: "reservation-create-1",
  requestDigest: "digest-create-1",
  ownerId: "worker-create-1",
});
const admitted = Object.freeze({
  authorized: true,
  principalId: binding.principalId,
  projectId: binding.projectId,
  ownershipRef: "ownership-create-1",
  ownershipRevision: 9,
  authorizationSource: "test-current-project-owner",
});

function makeStore({ beforeCreate = null } = {}) {
  let durable = null;
  let createCount = 0;
  let claimCount = 0;
  return {
    get durable() { return durable ? structuredClone(durable) : null; },
    get createCount() { return createCount; },
    get claimCount() { return claimCount; },
    async readExecution(executionId) { return durable?.executionId === executionId ? structuredClone(durable) : null; },
    async readExecutionByCreatorTurn(request = {}) {
      if (!durable) return null;
      return durable.creatorTurnId === request.creatorTurnId && durable.principalId === request.principalId && durable.projectId === request.projectId ? structuredClone(durable) : null;
    },
    async createExecution(next) {
      createCount += 1;
      if (beforeCreate) await beforeCreate(next);
      if (durable) return null;
      durable = structuredClone(next);
      return structuredClone(durable);
    },
    async replaceExecution(next) { durable = structuredClone(next); return structuredClone(durable); },
    async claimProviderCall({ providerCallId = "provider-call-test", slotId = "semantic", task = "semantic" } = {}) {
      claimCount += 1;
      if (!durable) return { claimed: false, execution: null };
      const providerCall = { providerCallId, slotId, task, leaseReference: durable.leaseReference, fencingToken: durable.fencingToken, admittedAt: new Date().toISOString() };
      durable = { ...durable, providerCallsClaimed: durable.providerCallsClaimed + 1, providerCalls: [...durable.providerCalls, providerCall] };
      return { claimed: true, providerCall: structuredClone(providerCall), execution: structuredClone(durable) };
    },
  };
}

function leaseFor(store, prefix = "create", requireCreationAuthority = true) {
  let id = 0;
  return createMovieMentorInferenceExecutionLeaseAuthority({
    store,
    requireCreationAuthority,
    now: () => new Date("2035-01-01T00:00:00.000Z"),
    randomId: () => `${prefix}-${++id}`,
  });
}

// Production lease composition must fail closed if the runtime forgets to mount creation authority.
{
  const store = makeStore();
  const lease = leaseFor(store, "missing");
  await assert.rejects(
    () => lease.openExecution(binding),
    (error) => error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_CREATION_AUTHORITY_REQUIRED",
  );
  assert.equal(store.createCount, 0, "production creation requirement must fail before durable createExecution");
  assert.equal(store.durable, null);
}

// A decorative/forged callback is not enough: the lease authority verifies the exact generation-one universe itself.
{
  const store = makeStore();
  const lease = leaseFor(store, "forged");
  await assert.rejects(
    () => lease.openExecution({
      ...binding,
      assertCurrentCreationAuthority: async (target) => ({
        authorized: true,
        currentOwnershipVerified: true,
        transition: "execution-creation",
        principalId: target.principalId,
        projectId: target.projectId,
        creatorTurnId: target.creatorTurnId,
        executionId: "forged-execution",
        reservationId: target.reservationId,
        requestDigest: target.requestDigest,
        ownerId: target.ownerId,
        leaseGeneration: 1,
        leaseReference: target.leaseReference,
        fencingToken: target.fencingToken,
      }),
    }),
    (error) => error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_CREATION_AUTHORITY_INVALID",
  );
  assert.equal(store.createCount, 0, "invalid proof must not touch durable creation");
}

// Revocation race: request admission/history/state may already have succeeded, but current ownership disappears before generation one is written.
{
  let authorizationCalls = 0;
  let externalEffects = 0;
  const store = makeStore();
  const lease = leaseFor(store, "revoked");
  const forwardExecutionAuthority = createMovieMentorForwardExecutionAuthority({
    request: { id: "request-create-revoked" },
    authorization: admitted,
    requestAuthority: {
      async authorize() {
        authorizationCalls += 1;
        return { authorized: false, principalId: binding.principalId, projectId: binding.projectId };
      },
    },
  });
  const guarded = createForwardExecutionRuntimeDeps({
    inferenceExecutionAuthority: lease,
    forwardExecutionAuthority,
  }).inferenceExecutionAuthority;

  await assert.rejects(
    async () => {
      const execution = await guarded.openExecution(binding);
      await guarded.claimProviderCall({ execution, slotId: "semantic", task: "movie-mentor-semantic" });
      externalEffects += 1;
    },
    (error) => error?.code === "MOVIE_MENTOR_FORWARD_EXECUTION_CURRENT_OWNERSHIP_REQUIRED",
  );
  assert.equal(authorizationCalls, 1, "fresh creation boundary must independently ask current ownership exactly once");
  assert.equal(store.createCount, 0, "revoked creator ownership must prevent generation-one durable creation");
  assert.equal(store.durable, null, "no execution id, lease reference or fencing token may become durable after revocation");
  assert.equal(store.claimCount, 0, "provider-call admission must remain unreachable when creation authority fails");
  assert.equal(externalEffects, 0, "revoked fresh creation must produce zero external effects");
}

// Positive control: current ownership remains valid and exactly one generation-one universe is created.
{
  let authorizationCalls = 0;
  const store = makeStore({
    beforeCreate(next) {
      assert.equal(authorizationCalls, 1, "fresh ownership proof must complete immediately before durable createExecution");
      assert.equal(next.leaseGeneration, 1);
    },
  });
  const lease = leaseFor(store, "current");
  const forwardExecutionAuthority = createMovieMentorForwardExecutionAuthority({
    request: { id: "request-create-current" },
    authorization: admitted,
    requestAuthority: {
      async authorize() { authorizationCalls += 1; return admitted; },
    },
  });
  const guarded = createForwardExecutionRuntimeDeps({ inferenceExecutionAuthority: lease, forwardExecutionAuthority }).inferenceExecutionAuthority;
  const created = await guarded.openExecution(binding);
  assert.equal(created.authorized, true);
  assert.equal(created.created, true);
  assert.equal(created.leaseGeneration, 1);
  assert.match(created.executionId, /^inference-execution-current-/);
  assert.match(created.leaseReference, /^inference-lease-1-current-/);
  assert.match(created.fencingToken, /^inference-fence-1-current-/);
  assert.equal(store.createCount, 1);
  assert.equal(store.durable?.executionId, created.executionId);
  assert.equal(authorizationCalls, 1);
}

const leaseSource = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionLeaseAuthority.js", import.meta.url), "utf8");
const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorForwardExecutionRuntime.js", import.meta.url), "utf8");
const productionSource = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js", import.meta.url), "utf8");
const gatewaySource = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
const proofIndex = leaseSource.indexOf("await input.assertCurrentCreationAuthority(next)");
const createIndex = leaseSource.indexOf("await store.createExecution(next)");
assert.ok(proofIndex >= 0 && createIndex > proofIndex, "the lease component that owns durable createExecution must ask current ownership immediately before the write");
assert.match(leaseSource, /requireCreationAuthority && typeof input\.assertCurrentCreationAuthority !== "function"/);
assert.match(runtimeSource, /guarded\.openExecution = async \(input = \{\}\) => base\.openExecution\(\{/);
assert.match(runtimeSource, /assertCurrentCreationAuthority: async \(target = \{\}\) => assertMovieMentorForwardExecutionCreationAuthority/);
assert.match(productionSource, /createMovieMentorInferenceExecutionLeaseAuthority\(\{(?=[^}]*store:durableStore)(?=[^}]*requireCreationAuthority:true)[^}]*\}\)/);
assert.match(productionSource, /freshExecutionCreationAuthorityRequired:true/);
assert.match(gatewaySource, /runTurn=runMovieMentorTurnWithForwardExecutionAuthority/);
assert.match(gatewaySource, /forwardExecutionAuthority=forwardExecutionAuthorityFrom\(req,authorized\)/);

console.log("✓ production lease composition refuses fresh creation without a server-owned current-ownership callback");
console.log("✓ the lease authority validates the exact generation-one proof; decorative callbacks cannot reach createExecution");
console.log("✓ ownership revocation before creation leaves zero durable execution, zero provider claims and zero external effect");
console.log("✓ stable current ownership permits exactly one generation-one execution/lease/fence universe");
console.log("✓ current ownership proof executes inside the lease component after absence is known and immediately before store.createExecution");
console.log("LAW: NO EXECUTION HISTORY IS REQUIRED TO CREATE GENERATION ONE, BUT CURRENT CREATOR/PROJECT OWNERSHIP IS.");
console.log("LAW: ZERO EXTERNAL EFFECT IS NOT ENOUGH; REVOKED OWNERSHIP MAY NOT CREATE DURABLE FORWARD AUTHORITY.");
console.log("ROUND SEVEN fresh execution creation torture: GREEN");
