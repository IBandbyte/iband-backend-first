import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";

console.log("Movie Mentor canonical finalization barrier race authority court");

const clone = value => value == null ? value : structuredClone(value);
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};
const digest = value => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const indexes = [
  { key: { resultReference: 1 }, unique: true },
  { key: { candidateReference: 1 }, unique: true },
  { key: { executionId: 1 }, unique: true },
  { key: { principalId: 1, projectId: 1, creatorTurnId: 1 }, unique: true },
  { key: { reservationId: 1 }, unique: true },
];

const payload = { response: { message: "barrier-race" }, metadata: { agent: "mentor" } };
const resultDigest = digest(payload);
const record = {
  resultReference: "canonical-race",
  candidateReference: "candidate-race",
  executionId: "execution-race",
  creatorTurnId: "turn-race",
  principalId: "creator-race",
  projectId: "project-race",
  reservationId: "reservation-race",
  requestDigest: "request-race",
  closureReference: "closure-race",
  closureCertificateDigest: "closure-digest-race",
  resultDigest,
  resultPayload: stable(payload),
  committedAt: "2035-01-01T00:00:00.000Z",
};

let canonicalRow = null;
let createCalls = 0;
let barrierWrites = 0;
let sessionsEnded = 0;
let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store",
  schema: 6,
  phase: "closed",
  providerEffectRealityRevision: 17,
  executionId: record.executionId,
  creatorTurnId: record.creatorTurnId,
  principalId: record.principalId,
  projectId: record.projectId,
  reservationId: record.reservationId,
  requestDigest: record.requestDigest,
  leaseGeneration: 5,
  leaseReference: "lease-race",
  fencingToken: "fence-race",
  closureReference: record.closureReference,
  closureCertificateDigest: record.closureCertificateDigest,
  resultFinalizationBarrierRevision: 0,
};
const candidateRow = {
  domain: "iband.movie-mentor.result-candidate-store",
  schema: 2,
  candidateReference: record.candidateReference,
  executionId: record.executionId,
  creatorTurnId: record.creatorTurnId,
  principalId: record.principalId,
  projectId: record.projectId,
  reservationId: record.reservationId,
  requestDigest: record.requestDigest,
  resultDigest,
  resultPayload: stable(payload),
  stagedFromLeaseGeneration: 5,
  stagedFromLeaseReference: "lease-race",
  stagedFromFencingToken: "fence-race",
  creatorStateRevision: 4,
  creatorStateGeneration: 3,
  creatorStateFingerprint: "state-fingerprint-race",
  creatorStateOwnershipRef: "ownership-race",
  creatorStateOwnershipRevision: 2,
  stagedAt: "2034-12-31T23:59:59.000Z",
};

function query(filter) {
  return {
    session() { return this; },
    lean() { return this; },
    async exec() {
      if (!canonicalRow) return null;
      if (filter.executionId && canonicalRow.executionId !== filter.executionId) return null;
      if (filter.principalId && canonicalRow.principalId !== filter.principalId) return null;
      if (filter.projectId && canonicalRow.projectId !== filter.projectId) return null;
      if (filter.creatorTurnId && canonicalRow.creatorTurnId !== filter.creatorTurnId) return null;
      return clone(canonicalRow);
    },
  };
}

const mongoModel = {
  findOne(filter) { return query(filter); },
  async create(rows) {
    createCalls += 1;
    canonicalRow = clone(rows[0]);
    return [clone(canonicalRow)];
  },
};

const executionCollection = {
  async findOne() { return clone(executionRow); },
  async updateOne(filter) {
    barrierWrites += 1;
    assert.equal(filter.executionId, record.executionId);
    assert.equal(filter.phase, "closed");
    assert.equal(filter.providerEffectRealityRevision, 17);

    // Adversarial reality change after validation but before the finalization barrier.
    executionRow = { ...executionRow, providerEffectRealityRevision: 18 };
    return { matchedCount: 0, modifiedCount: 0 };
  },
};

const candidateCollection = {
  async findOne() { return clone(candidateRow); },
};

const startSession = async () => ({
  async withTransaction(fn) {
    const beforeCanonical = clone(canonicalRow);
    try {
      return await fn();
    } catch (error) {
      // Model transaction rollback: a failed barrier may not leave canonical authority behind.
      canonicalRow = beforeCanonical;
      throw error;
    }
  },
  async endSession() { sessionsEnded += 1; },
});

const store = createMovieMentorCanonicalResultMongoStore({
  mongoModel,
  executionCollection,
  candidateCollection,
  startSession,
  readIndexes: async () => indexes,
});

let failure = null;
try {
  await store.commit(record, { expectedProviderEffectRealityRevision: 17 });
} catch (error) {
  failure = error;
}

assert.ok(failure, "stale reality at the finalization barrier must fail closed");
assert.equal(failure.code, "MOVIE_MENTOR_CANONICAL_RESULT_FINALIZATION_RACE");
assert.equal(createCalls, 1, "the court must reach the irreversible canonical insert attempt before the barrier race");
assert.equal(barrierWrites, 1, "the stale reality must be detected by the finalization barrier itself");
assert.equal(canonicalRow, null, "failed finalization transaction must not leave canonical authority durable");
assert.equal(executionRow.phase, "closed", "stale finalization must not advance execution to FINALIZED");
assert.equal(executionRow.providerEffectRealityRevision, 18, "the adversarial reality change must survive the failed stale transaction");
assert.equal(executionRow.resultFinalizationBarrierRevision, 0, "failed stale finalization must not increment the finalization barrier revision");
assert.equal(sessionsEnded, 1, "failed transaction must close its session");

console.log("✓ provider-effect reality can move after validation and before the CLOSED→FINALIZED barrier");
console.log("✓ stale barrier match fails with MOVIE_MENTOR_CANONICAL_RESULT_FINALIZATION_RACE");
console.log("✓ failed transaction leaves no canonical authority and does not advance FINALIZED");
console.log("LAW: VALIDATED REALITY MAY EXPIRE BEFORE FINALIZATION; STALE REALITY MUST ACQUIRE ZERO CANONICAL AUTHORITY.");
console.log("Movie Mentor canonical finalization barrier race authority: GREEN");
