import assert from "node:assert/strict";
import { createMovieMentorProviderEffectMongoStore } from "../ai/MovieMentorProviderEffectMongoStore.js";

const clone = value => value == null ? value : structuredClone(value);
const now = new Date("2031-01-01T00:00:00.000Z");

function query(result) {
  return {
    session() { return this; },
    lean() { return this; },
    async exec() { return clone(result); }
  };
}

function makeHarness({ execution = null, existingEffect = null } = {}) {
  const effects = new Map();
  if (existingEffect) effects.set(existingEffect.providerCallId, clone(existingEffect));
  let executionRow = clone(execution);
  let revisionTouches = 0;

  const model = {
    findOne(filter) { return query(effects.get(filter.providerCallId) || null); },
    async create(rows) {
      const row = clone(rows[0]);
      effects.set(row.providerCallId, row);
      return [clone(row)];
    }
  };

  const executionCollection = {
    async updateOne(filter) {
      const row = executionRow;
      const call = row?.providerCalls?.find(item =>
        item.providerCallId === filter.providerCalls?.$elemMatch?.providerCallId &&
        item.slotId === filter.providerCalls?.$elemMatch?.slotId &&
        item.task === filter.providerCalls?.$elemMatch?.task &&
        item.leaseGeneration === filter.providerCalls?.$elemMatch?.leaseGeneration &&
        item.leaseReference === filter.providerCalls?.$elemMatch?.leaseReference &&
        item.fencingToken === filter.providerCalls?.$elemMatch?.fencingToken
      );
      const matches = Boolean(row &&
        row.executionId === filter.executionId && row.phase === filter.phase &&
        row.ownerId === filter.ownerId && row.leaseGeneration === filter.leaseGeneration &&
        row.leaseReference === filter.leaseReference && row.fencingToken === filter.fencingToken &&
        new Date(row.leaseExpiresAt).getTime() > new Date(filter.leaseExpiresAt.$gt).getTime() && call);
      if (matches) revisionTouches += 1;
      return { matchedCount: matches ? 1 : 0, modifiedCount: matches ? 1 : 0 };
    }
  };

  const session = { async withTransaction(fn) { await fn(); }, async endSession() {} };
  const store = createMovieMentorProviderEffectMongoStore({
    mongoModel: null,
    connect: async () => {},
    startSession: async () => session,
    executionCollection
  });
  return { store, effects, get revisionTouches() { return revisionTouches; } };
}

const admittedCall = Object.freeze({
  providerCallId: "call-1", executionId: "execution-1", slotId: "semantic", task: "interpret-semantics",
  ownerId: "worker-1", leaseGeneration: 7, leaseReference: "lease-7", fencingToken: "fence-7",
  dispatchUnknownAt: now.toISOString()
});
const execution = Object.freeze({
  executionId: "execution-1", phase: "active", ownerId: "worker-1", leaseGeneration: 7,
  leaseReference: "lease-7", fencingToken: "fence-7", leaseExpiresAt: "2031-01-01T00:05:00.000Z",
  providerCalls: [Object.freeze({ providerCallId: "call-1", slotId: "semantic", task: "interpret-semantics", leaseGeneration: 7, leaseReference: "lease-7", fencingToken: "fence-7" })]
});

async function denied(label, mutate, executionOverride = execution) {
  const harness = makeHarness({ execution: executionOverride });
  const input = mutate({ ...admittedCall });
  await assert.rejects(() => harness.store.beginUnknown(input), error => error?.code === "MOVIE_MENTOR_PROVIDER_EFFECT_EXECUTION_FENCED", label);
  assert.equal(harness.effects.size, 0, `${label}: zero UNKNOWN reality may be created`);
  assert.equal(harness.revisionTouches, 0, `${label}: zero execution reality revision may be credited`);
}

console.log("Gates of Execution — Provider Effect Cross-Ledger Admission torture");
const genuine = makeHarness({ execution });
const created = await genuine.store.beginUnknown(admittedCall);
assert.equal(created.state, "unknown");
assert.equal(created.providerCallId, admittedCall.providerCallId);
assert.equal(genuine.effects.size, 1);
assert.equal(genuine.revisionTouches, 1);

await denied("never-admitted provider call", value => ({ ...value, providerCallId: "call-never-admitted" }));
await denied("wrong slot", value => ({ ...value, slotId: "story" }));
await denied("wrong task", value => ({ ...value, task: "generate-story" }));
await denied("stale generation", value => ({ ...value, leaseGeneration: 6 }));
await denied("wrong lease reference", value => ({ ...value, leaseReference: "lease-forged" }));
await denied("wrong fencing token", value => ({ ...value, fencingToken: "fence-forged" }));
await denied("expired lease", value => value, { ...execution, leaseExpiresAt: "2030-12-31T23:59:59.000Z" });
await denied("closed execution", value => value, { ...execution, phase: "closed" });

console.log("✓ genuine current durably admitted provider call may create UNKNOWN");
console.log("✓ never-admitted / wrong-slot / wrong-task lookalikes create zero UNKNOWN");
console.log("✓ stale-generation / wrong-reference / wrong-fence lookalikes create zero UNKNOWN");
console.log("✓ expired or non-active execution creates zero UNKNOWN");
console.log("LAW: CURRENT DURABLE EXECUTION + EXACT ADMITTED PROVIDER CALL → ATOMIC UNKNOWN REALITY; LOOKALIKE → ZERO AUTHORITY");
console.log("Zorg: But the form says dispatchAuthorized. Kraken: THE DURABLE LEDGER DISAGREES.");
