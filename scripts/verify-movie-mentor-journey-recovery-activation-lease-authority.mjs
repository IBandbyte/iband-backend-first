import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryActivationLeaseAuthority } from "../ai/MovieMentorJourneyRecoveryActivationLeaseAuthority.js";

let clock = new Date("2030-01-01T00:00:00.000Z");
let durable = null;
let id = 0;
let ackLoss = false;
const clone = (v) => v ? structuredClone(v) : null;
const readLease = async () => clone(durable);
const createLease = async (next) => { if (durable) return null; durable = clone(next); if (ackLoss) { ackLoss = false; throw Object.assign(new Error("create ACK lost"), { code: "ACK_LOST" }); } return clone(durable); };
const replaceLease = async (next, expected = {}) => {
  if (!durable || durable.leaseGeneration !== expected.expectedLeaseGeneration || durable.leaseReference !== expected.expectedLeaseReference) return null;
  if (expected.expectedExpiresAt && durable.expiresAt !== expected.expectedExpiresAt) return null;
  durable = clone(next);
  if (ackLoss) { ackLoss = false; throw Object.assign(new Error("replace ACK lost"), { code: "ACK_LOST" }); }
  return clone(durable);
};
const authority = createMovieMentorJourneyRecoveryActivationLeaseAuthority({ readLease, createLease, replaceLease, now: () => new Date(clock), leaseMs: 1000, randomId: () => `id-${++id}` });
const binding = (processInstanceId, deploymentId = "deploy-A") => ({ processInstanceId, deploymentId, basePath: "/api/movie-mentor-recovery", expectedIssuer: "issuer", expectedAudience: "audience" });

console.log("3C.5E.4G — durable activation lease & fencing torture");
const a = await authority.authorizeActivation(binding("process-A"));
assert.equal(a.authorized, true); assert.equal(a.leaseGeneration, 1);
const blocked = await authority.authorizeActivation(binding("process-B"));
assert.equal(blocked.authorized, false); assert.equal(blocked.reason, "activation-lease-held-by-another-process");
const aAgain = await authority.authorizeActivation(binding("process-A"));
assert.equal(aAgain.activationReference, a.activationReference);
clock = new Date(clock.getTime() + 1001);
const b = await authority.authorizeActivation(binding("process-B", "deploy-B"));
assert.equal(b.authorized, true); assert.equal(b.leaseGeneration, 2); assert.notEqual(b.fencingToken, a.fencingToken);
const staleA = await authority.assertFence({ processInstanceId: "process-A", activationEpoch: a.activationEpoch, activationReference: a.activationReference, fencingToken: a.fencingToken });
assert.equal(staleA.authorized, false);
const liveB = await authority.assertFence({ processInstanceId: "process-B", activationEpoch: b.activationEpoch, activationReference: b.activationReference, fencingToken: b.fencingToken });
assert.equal(liveB.authorized, true);
const staleRenew = await authority.renewActivation({ ...binding("process-A"), activationEpoch: a.activationEpoch, activationReference: a.activationReference, fencingToken: a.fencingToken });
assert.equal(staleRenew.authorized, false);
ackLoss = true;
const renewedB = await authority.renewActivation({ ...binding("process-B", "deploy-B"), activationEpoch: b.activationEpoch, activationReference: b.activationReference, fencingToken: b.fencingToken });
assert.equal(renewedB.authorized, true); assert.equal(renewedB.leaseGeneration, 2);
clock = new Date(new Date(renewedB.expiresAt).getTime() + 1);
ackLoss = true;
const c = await authority.authorizeActivation(binding("process-C", "deploy-C"));
assert.equal(c.authorized, true); assert.equal(c.leaseGeneration, 3);
const zombieB = await authority.assertFence({ processInstanceId: "process-B", activationEpoch: b.activationEpoch, activationReference: b.activationReference, fencingToken: b.fencingToken });
assert.equal(zombieB.authorized, false);

console.log("✓ single active holder while lease is live");
console.log("✓ takeover only after durable expiry");
console.log("✓ each takeover advances monotonic fencing generation");
console.log("✓ stale/zombie processes are fenced after takeover");
console.log("✓ renewal ACK loss reconciles from durable reality");
console.log("✓ takeover ACK loss reconciles without minting another epoch");
console.log("LAW: an old process may wake up; an old fencing epoch may not regain authority");
console.log("3C.5E.4G torture: GREEN");
