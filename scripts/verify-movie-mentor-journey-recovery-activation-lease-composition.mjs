import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createMovieMentorJourneyRecoveryActivationLeaseComposition,
} from "../ai/MovieMentorJourneyRecoveryActivationLeaseComposition.js";

const STORE_STATUS = Object.freeze({
  version: "test",
  domain: "iband.movie-mentor.journey-recovery-activation-lease-store",
  configured: true,
  readiness: "test-durable-store",
  collection: "test-shared-durable-activation-lease",
  serviceKey: "movie-mentor-journey-recovery-activation",
  durable: true,
  singleton: true,
  generationFenced: true,
  renewalCas: true,
  cas: "generation-reference-expiry",
  processLocalFallback: false,
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, `expected ${code}`);
}

function createSharedDurableStore({ status = STORE_STATUS } = {}) {
  let durable = null;
  let replaceAckLoss = false;

  return {
    getStatus() {
      return status;
    },
    corruptReadWith(error) {
      durable = { __throw: error };
    },
    loseNextReplaceAck() {
      replaceAckLoss = true;
    },
    snapshot() {
      return durable && !durable.__throw ? clone(durable) : durable;
    },
    async readLease() {
      if (durable?.__throw) throw durable.__throw;
      return clone(durable);
    },
    async createLease(next) {
      if (durable) return null;
      durable = clone(next);
      return clone(durable);
    },
    async replaceLease(next, expected = {}) {
      if (!durable || durable.__throw) return null;
      if (
        durable.leaseGeneration !== expected.expectedLeaseGeneration ||
        durable.leaseReference !== expected.expectedLeaseReference
      ) return null;
      if (expected.expectedExpiresAt && durable.expiresAt !== expected.expectedExpiresAt) return null;
      durable = clone(next);
      if (replaceAckLoss) {
        replaceAckLoss = false;
        const error = new Error("simulated replace ACK loss after durable commit");
        error.code = "SIMULATED_REPLACE_ACK_LOSS";
        throw error;
      }
      return clone(durable);
    },
  };
}

function methodOnlyStore() {
  return {
    async readLease() { return null; },
    async createLease() { return null; },
    async replaceLease() { return null; },
  };
}

function binding(processInstanceId, deploymentId) {
  return {
    processInstanceId,
    deploymentId,
    basePath: "/api/movie-mentor-recovery",
    expectedIssuer: "movie-mentor",
    expectedAudience: "movie-mentor-recovery",
  };
}

console.log("[4G.2] durable lease authority composition torture starting");

expectCode(
  () => createMovieMentorJourneyRecoveryActivationLeaseComposition({
    getStoreStatus: () => ({ configured: false }),
    createStore: () => { throw new Error("must not create unconfigured store"); },
  }),
  "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_NOT_CONFIGURED"
);
console.log("[4G.2] missing durable configuration fails closed: GREEN");

expectCode(
  () => createMovieMentorJourneyRecoveryActivationLeaseComposition({ store: {} }),
  "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_STORE_INVALID"
);
console.log("[4G.2] malformed durable store contract fails closed: GREEN");

expectCode(
  () => createMovieMentorJourneyRecoveryActivationLeaseComposition({ store: methodOnlyStore() }),
  "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_STORE_CAPABILITY_NOT_PROVEN"
);
console.log("[4G.2] method-shaped injected store receives zero durability authority: GREEN");

expectCode(
  () => createMovieMentorJourneyRecoveryActivationLeaseComposition({
    store: createSharedDurableStore({ status: Object.freeze({ configured: true, injected: true }) }),
  }),
  "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_STORE_CAPABILITY_NOT_PROVEN"
);
console.log("[4G.2] deceptive configured/injected status receives zero durability authority: GREEN");

expectCode(
  () => createMovieMentorJourneyRecoveryActivationLeaseComposition({
    store: createSharedDurableStore({ status: Object.freeze({ ...STORE_STATUS, processLocalFallback: true }) }),
  }),
  "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_STORE_CAPABILITY_NOT_PROVEN"
);
console.log("[4G.2] process-local fallback cannot masquerade as durable authority: GREEN");

expectCode(
  () => createMovieMentorJourneyRecoveryActivationLeaseComposition({
    store: createSharedDurableStore(),
    createAuthority: () => ({}),
  }),
  "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_COMPOSITION_AUTHORITY_INVALID"
);
console.log("[4G.2] malformed authority contract fails closed: GREEN");

const store = createSharedDurableStore();
let nowMs = Date.parse("2026-08-28T12:00:00.000Z");
let id = 0;
const options = () => ({
  store,
  authorityOptions: {
    now: () => new Date(nowMs),
    leaseMs: 10_000,
    randomId: () => `composition-${++id}`,
  },
});

const processA = createMovieMentorJourneyRecoveryActivationLeaseComposition(options());
assert.equal(processA.getStatus().ready, true);
assert.equal(processA.getStatus().durable, true);
assert.equal(processA.getStatus().source, "injected-store");
assert.equal(processA.getStatus().store, STORE_STATUS);
assert.equal(processA.getStatus().bootWired, false);
console.log("[4G.2] composition consumes exact store-owned durability proof: GREEN");

const aBinding = binding("process-A", "deploy-A");
const first = await processA.authorizeActivation(aBinding);
assert.equal(first.authorized, true);
assert.equal(first.activationEpoch, "1");
assert.ok(first.activationReference);
assert.ok(first.fencingToken);
console.log("[4G.2] first composed process acquires durable generation 1: GREEN");

const restartedA = createMovieMentorJourneyRecoveryActivationLeaseComposition(options());
const restored = await restartedA.authorizeActivation(aBinding);
assert.equal(restored.authorized, true);
assert.equal(restored.activationEpoch, "1");
assert.equal(restored.activationReference, first.activationReference);
assert.equal(restored.fencingToken, first.fencingToken);
console.log("[4G.2] fresh composition restores durable holder reality after restart: GREEN");

const processB = createMovieMentorJourneyRecoveryActivationLeaseComposition(options());
const bBinding = binding("process-B", "deploy-B");
const blocked = await processB.authorizeActivation(bBinding);
assert.equal(blocked.authorized, false);
assert.equal(blocked.reason, "activation-lease-held-by-another-process");
assert.equal(blocked.activationEpoch, "1");
console.log("[4G.2] concurrent process cannot bypass composed durable holder: GREEN");

nowMs += 10_001;
const takeover = await processB.authorizeActivation(bBinding);
assert.equal(takeover.authorized, true);
assert.equal(takeover.activationEpoch, "2");
assert.notEqual(takeover.activationReference, first.activationReference);
assert.notEqual(takeover.fencingToken, first.fencingToken);
console.log("[4G.2] expiry permits exactly-next-generation takeover through composition: GREEN");

const staleFence = await processA.assertFence({
  processInstanceId: aBinding.processInstanceId,
  activationEpoch: first.activationEpoch,
  activationReference: first.activationReference,
  fencingToken: first.fencingToken,
});
assert.equal(staleFence.authorized, false);
assert.equal(staleFence.reason, "activation-lease-fenced");
console.log("[4G.2] old process is fenced after composed takeover: GREEN");

const renewed = await processB.renewActivation({
  ...bBinding,
  activationEpoch: takeover.activationEpoch,
  activationReference: takeover.activationReference,
  fencingToken: takeover.fencingToken,
});
assert.equal(renewed.authorized, true);
assert.equal(renewed.activationEpoch, takeover.activationEpoch);
assert.equal(renewed.activationReference, takeover.activationReference);
assert.equal(renewed.fencingToken, takeover.fencingToken);
assert.ok(Date.parse(renewed.expiresAt) > Date.parse(takeover.expiresAt));
console.log("[4G.2] renewal preserves fencing identity and advances expiry: GREEN");

nowMs = Date.parse(renewed.expiresAt) + 1;
store.loseNextReplaceAck();
const processC = createMovieMentorJourneyRecoveryActivationLeaseComposition(options());
const cBinding = binding("process-C", "deploy-C");
const ackLostTakeover = await processC.authorizeActivation(cBinding);
assert.equal(ackLostTakeover.authorized, true);
assert.equal(ackLostTakeover.activationEpoch, "3");
assert.equal(store.snapshot().leaseGeneration, 3);
assert.equal(store.snapshot().leaseReference, ackLostTakeover.activationReference);
console.log("[4G.2] lost replace ACK reconciles against durable reality through composition: GREEN");

const malformed = new Error("durable record malformed");
malformed.code = "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RECORD_INVALID";
store.corruptReadWith(malformed);
await assert.rejects(
  () => processC.assertFence({
    processInstanceId: cBinding.processInstanceId,
    activationEpoch: ackLostTakeover.activationEpoch,
    activationReference: ackLostTakeover.activationReference,
    fencingToken: ackLostTakeover.fencingToken,
  }),
  (error) => error?.code === "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RECORD_INVALID"
);
console.log("[4G.2] malformed durable reality propagates fail-closed: GREEN");

const compositionSource = await readFile(
  new URL("../ai/MovieMentorJourneyRecoveryActivationLeaseComposition.js", import.meta.url),
  "utf8"
);
const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");
assert.equal(/from\s+["'][^"']*server\.js["']/.test(compositionSource), false);
assert.equal(/\bapp\.use\s*\(/.test(compositionSource), false);
assert.equal(compositionSource.includes("express"), false);
assert.equal(compositionSource.includes("freeze({ configured: true, injected: true })"), false);
assert.equal(serverSource.includes("MovieMentorJourneyRecoveryActivationLeaseComposition"), false);
console.log("[4G.2] composition has no Express/server mount authority and cannot manufacture injected durability proof: GREEN");

console.log("[4G.2] law: Mongo Store -> Store-Owned Capability Proof -> Lease Authority -> Composition Boundary -> Torture -> Certification");
console.log("[4G.2] law: missing durable configuration is not permission to degrade to process-local authority");
console.log("[4G.2] law: method shape is not durability; the store owns the proof");
console.log("[4G.2] law: restart may recover durable holder reality; stale epochs may not recover authority");
console.log("[4G.2] law: COMPOSITION FIRST. BOOT LATER.");
console.log("[4G.2] ALL GREEN");
