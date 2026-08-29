import assert from "node:assert/strict";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

let clock = new Date("2030-01-01T00:00:00.000Z");
let durable = null;
let id = 0;
let loseCreateAck = false;
let loseReplaceAck = false;
const clone = (value) => value ? structuredClone(value) : null;

const store = {
  async readExecution(executionId) { return durable && durable.executionId === executionId ? clone(durable) : null; },
  async readExecutionByCreatorTurn({ principalId, projectId, creatorTurnId } = {}) {
    return durable && durable.principalId === principalId && durable.projectId === projectId && durable.creatorTurnId === creatorTurnId ? clone(durable) : null;
  },
  async createExecution(next) {
    if (durable) return null;
    durable = clone(next);
    if (loseCreateAck) { loseCreateAck = false; throw Object.assign(new Error("create ACK lost"), { code: "ACK_LOST" }); }
    return clone(durable);
  },
  async replaceExecution(next, expected = {}) {
    if (!durable || durable.executionId !== next.executionId || durable.phase !== expected.expectedPhase || durable.leaseGeneration !== expected.expectedLeaseGeneration || durable.leaseReference !== expected.expectedLeaseReference) return null;
    if (expected.expectedLeaseExpiresAt && durable.leaseExpiresAt !== expected.expectedLeaseExpiresAt) return null;
    durable = clone(next);
    if (loseReplaceAck) { loseReplaceAck = false; throw Object.assign(new Error("replace ACK lost"), { code: "ACK_LOST" }); }
    return clone(durable);
  },
};

const authority = createMovieMentorInferenceExecutionLeaseAuthority({ store, now: () => new Date(clock), leaseMs: 1000, maxProviderCalls: 5, randomId: () => `id-${++id}` });
const base = { creatorTurnId: "turn-1", principalId: "creator-1", projectId: "project-1", reservationId: "reservation-1", requestDigest: "sha256:req-1", ownerId: "worker-A" };

console.log("5A.24 Round One — durable execution identity + lease + fencing torture");

loseCreateAck = true;
const opened = await authority.openExecution(base);
assert.equal(opened.authorized, true);
assert.equal(opened.leaseGeneration, 1);
assert.equal(opened.reconciledAckLoss, true);
assert.equal(opened.maxProviderCalls, 5);

const replay = await authority.openExecution(base);
assert.equal(replay.authorized, true);
assert.equal(replay.executionId, opened.executionId);
assert.equal(replay.idempotent, true);

await assert.rejects(() => authority.openExecution({ ...base, requestDigest: "sha256:changed" }), (error) => error?.code === "MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT");

const blocked = await authority.acquireExecution({ executionId: opened.executionId, ownerId: "worker-B" });
assert.equal(blocked.authorized, false);
assert.equal(blocked.reason, "execution-lease-held-by-another-owner");

const liveA = await authority.assertFence(opened);
assert.equal(liveA.authorized, true);

clock = new Date(clock.getTime() + 1001);
loseReplaceAck = true;
const takeover = await authority.acquireExecution({ executionId: opened.executionId, ownerId: "worker-B" });
assert.equal(takeover.authorized, true);
assert.equal(takeover.leaseGeneration, 2);
assert.equal(takeover.reconciledAckLoss, true);
assert.notEqual(takeover.leaseReference, opened.leaseReference);
assert.notEqual(takeover.fencingToken, opened.fencingToken);

const zombieA = await authority.assertFence(opened);
assert.equal(zombieA.authorized, false);

const currentB = await authority.assertFence(takeover);
assert.equal(currentB.authorized, true);

loseReplaceAck = true;
const renewed = await authority.renewExecution(takeover);
assert.equal(renewed.authorized, true);
assert.equal(renewed.leaseGeneration, 2);
assert.equal(renewed.reconciledAckLoss, true);
assert.equal(renewed.fencingToken, takeover.fencingToken);

const afterRenew = await authority.assertFence(renewed);
assert.equal(afterRenew.authorized, true);

console.log("✓ creatorTurnId replay converges on one durable execution identity");
console.log("✓ changed immutable binding under the same creatorTurnId conflicts");
console.log("✓ live lease rejects competing execution owner");
console.log("✓ expired lease takeover advances generation exactly once");
console.log("✓ takeover mints fresh lease reference + fencing token");
console.log("✓ stale/zombie owner loses all forward execution authority");
console.log("✓ create/takeover/renew ACK loss reconciles from durable reality");
console.log("LAW: durable execution reality outranks process memory");
console.log("LAW: stale owner -> zero forward authority");
console.log("5A.24 Round One foundation torture: GREEN");
