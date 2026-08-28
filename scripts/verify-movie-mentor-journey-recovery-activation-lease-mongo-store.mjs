import assert from "node:assert/strict";
import {
  createMovieMentorJourneyRecoveryActivationLeaseMongoStore,
  inspectMovieMentorJourneyRecoveryActivationLease,
  MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_DOMAIN,
  MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_SCHEMA,
  MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_SERVICE_KEY,
} from "../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js";

const clone = (value) => value ? structuredClone(value) : null;
const eq = (left, right) => left instanceof Date || right instanceof Date ? new Date(left).toISOString() === new Date(right).toISOString() : left === right;

function fakeModel() {
  let durable = null;
  let ackLoss = null;
  const matches = (record, filter) => record && Object.entries(filter).every(([key, value]) => eq(record[key], value));
  const chain = (value) => ({ lean() { return this; }, exec: async () => clone(value) });
  return {
    loseNextAck(kind) { ackLoss = kind; },
    corrupt(value) { durable = clone(value); },
    snapshot() { return clone(durable); },
    findOne(filter) { return chain(matches(durable, filter) ? durable : null); },
    async create(next) {
      if (durable) { const error = new Error("duplicate singleton"); error.code = 11000; throw error; }
      durable = clone(next);
      if (ackLoss === "create") { ackLoss = null; throw Object.assign(new Error("create ACK lost"), { code: "ACK_LOST" }); }
      return clone(durable);
    },
    findOneAndUpdate(filter, update) {
      const matched = matches(durable, filter);
      if (matched) durable = clone(update.$set);
      const result = matched ? durable : null;
      return {
        lean() { return this; },
        exec: async () => {
          if (matched && ackLoss === "replace") { ackLoss = null; throw Object.assign(new Error("replace ACK lost"), { code: "ACK_LOST" }); }
          return clone(result);
        },
      };
    },
  };
}

function lease(generation, processInstanceId, deploymentId, acquiredAt, expiresAt, suffix = processInstanceId) {
  return {
    processInstanceId,
    deploymentId,
    basePath: "/api/movie-mentor-recovery",
    expectedIssuer: "issuer",
    expectedAudience: "audience",
    status: "active",
    leaseGeneration: generation,
    leaseReference: `ref-${generation}-${suffix}`,
    fencingToken: `fence-${generation}-${suffix}`,
    acquiredAt,
    expiresAt,
  };
}

console.log("3C.5E.4G.1 — durable Mongo activation lease store & CAS torture");

const model = fakeModel();
const store = createMovieMentorJourneyRecoveryActivationLeaseMongoStore({ mongoModel: model });
const t0 = "2030-01-01T00:00:00.000Z";
const t1 = "2030-01-01T00:00:01.000Z";
const t2 = "2030-01-01T00:00:02.000Z";
const t3 = "2030-01-01T00:00:03.000Z";

assert.equal(await store.readLease(), null);
const first = await store.createLease(lease(1, "process-A", "deploy-A", t0, t1));
assert.equal(first.leaseGeneration, 1);
assert.equal((await store.createLease(lease(1, "process-B", "deploy-B", t0, t1, "B"))), null, "singleton create-first CAS must admit one winner");

const staleTakeover = await store.replaceLease(lease(2, "process-B", "deploy-B", t1, t2, "B"), { expectedLeaseGeneration: 0, expectedLeaseReference: "missing" }).catch((error) => error);
assert.equal(staleTakeover.code, "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_CAS_REQUIRED");

const takeover = await store.replaceLease(lease(2, "process-B", "deploy-B", t1, t2, "B"), { expectedLeaseGeneration: 1, expectedLeaseReference: first.leaseReference });
assert.equal(takeover.leaseGeneration, 2);
assert.notEqual(takeover.fencingToken, first.fencingToken);

const zombie = await store.replaceLease(lease(2, "process-A", "deploy-A", t0, t3, "A-renew"), { expectedLeaseGeneration: 1, expectedLeaseReference: first.leaseReference, expectedExpiresAt: t1 });
assert.equal(zombie, null, "stale generation/reference must never regain authority");

const badRollback = await store.replaceLease(lease(1, "process-X", "deploy-X", t2, t3, "rollback"), { expectedLeaseGeneration: 2, expectedLeaseReference: takeover.leaseReference }).catch((error) => error);
assert.equal(badRollback.code, "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_GENERATION_TRANSITION_INVALID");

const renewalWithoutExpiryCas = await store.replaceLease({ ...takeover, expiresAt: t3 }, { expectedLeaseGeneration: 2, expectedLeaseReference: takeover.leaseReference }).catch((error) => error);
assert.equal(renewalWithoutExpiryCas.code, "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RENEWAL_EXPIRY_CAS_REQUIRED");

const renewal = await store.replaceLease({ ...takeover, expiresAt: t3 }, { expectedLeaseGeneration: 2, expectedLeaseReference: takeover.leaseReference, expectedExpiresAt: t2 });
assert.equal(renewal.expiresAt, t3);

const simultaneousRenewalLoser = await store.replaceLease({ ...takeover, expiresAt: "2030-01-01T00:00:04.000Z" }, { expectedLeaseGeneration: 2, expectedLeaseReference: takeover.leaseReference, expectedExpiresAt: t2 });
assert.equal(simultaneousRenewalLoser, null, "previous-expiry CAS must reject a concurrent stale renewal");

const fenceReuse = await store.replaceLease({ ...lease(3, "process-C", "deploy-C", t3, "2030-01-01T00:00:04.000Z", "C"), fencingToken: renewal.fencingToken }, { expectedLeaseGeneration: 2, expectedLeaseReference: renewal.leaseReference }).catch((error) => error);
assert.equal(fenceReuse.code, "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_TAKEOVER_FENCE_REUSE");

const beforeAckLoss = model.snapshot();
model.loseNextAck("replace");
const intended = lease(3, "process-C", "deploy-C", t3, "2030-01-01T00:00:04.000Z", "C");
await assert.rejects(() => store.replaceLease(intended, { expectedLeaseGeneration: 2, expectedLeaseReference: renewal.leaseReference }), /ACK lost/);
const durableAfterAckLoss = await store.readLease();
assert.equal(durableAfterAckLoss.leaseGeneration, 3);
assert.equal(durableAfterAckLoss.leaseReference, intended.leaseReference);
assert.notDeepEqual(model.snapshot(), beforeAckLoss, "ACK loss must be able to occur after durable replacement");

const inspection = inspectMovieMentorJourneyRecoveryActivationLease({
  domain: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_DOMAIN,
  schema: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_SCHEMA,
  serviceKey: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_SERVICE_KEY,
  ...intended,
});
assert.equal(inspection.valid, true);

model.corrupt({
  domain: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_DOMAIN,
  schema: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_SCHEMA,
  serviceKey: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_SERVICE_KEY,
  ...intended,
  leaseGeneration: 0,
});
await assert.rejects(() => store.readLease(), (error) => error?.code === "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RECORD_INVALID");

const createAckModel = fakeModel();
const createAckStore = createMovieMentorJourneyRecoveryActivationLeaseMongoStore({ mongoModel: createAckModel });
createAckModel.loseNextAck("create");
await assert.rejects(() => createAckStore.createLease(lease(1, "process-Z", "deploy-Z", t0, t1, "Z")), /ACK lost/);
assert.equal((await createAckStore.readLease()).leaseReference, "ref-1-Z", "durable reality must remain readable after create ACK loss for authority reconciliation");

console.log("✓ unique singleton/service-level lease identity");
console.log("✓ create-first CAS admits one generation-1 winner");
console.log("✓ replacement CAS binds expected generation and lease reference");
console.log("✓ renewal CAS additionally binds exact previous expiry");
console.log("✓ stale generation, stale reference, and stale renewal are rejected");
console.log("✓ generation rollback/resurrection is prohibited");
console.log("✓ takeover cannot recycle a fencing token or lease reference");
console.log("✓ ACK-loss leaves committed durable reality available for reread reconciliation");
console.log("✓ malformed durable records fail closed");
console.log("✓ store is independently injectable; no boot wiring or other recovery stores involved");
console.log("LAW: uncertainty is not authority to advance a fencing epoch; durable Mongo reality decides what committed");
console.log("3C.5E.4G.1 Mongo store torture: GREEN");
