import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";

console.log("Movie Mentor canonical result duplicate-key recovery authority court");

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

const payload = { response: { message: "winner" }, metadata: { agent: "mentor" } };
const resultDigest = digest(payload);
const requested = {
  resultReference: "canonical-requested",
  candidateReference: "candidate-dup",
  executionId: "execution-dup",
  creatorTurnId: "turn-dup",
  principalId: "creator-dup",
  projectId: "project-dup",
  reservationId: "reservation-dup",
  requestDigest: "request-dup",
  closureReference: "closure-dup",
  closureCertificateDigest: "closure-digest-dup",
  resultDigest,
  resultPayload: stable(payload),
  committedAt: "2034-01-01T00:00:00.000Z",
};
const winner = {
  domain: "iband.movie-mentor.canonical-result-store",
  schema: 2,
  ...requested,
  resultReference: "canonical-winner",
  committedAt: new Date(requested.committedAt),
};

let canonicalRow = null;
let createCalls = 0;
let executionReads = 0;
let candidateReads = 0;
let barrierWrites = 0;
let sessionsEnded = 0;
let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store",
  schema: 6,
  phase: "closed",
  providerEffectRealityRevision: 11,
  executionId: requested.executionId,
  creatorTurnId: requested.creatorTurnId,
  principalId: requested.principalId,
  projectId: requested.projectId,
  reservationId: requested.reservationId,
  requestDigest: requested.requestDigest,
  leaseGeneration: 4,
  leaseReference: "lease-dup",
  fencingToken: "fence-dup",
  closureReference: requested.closureReference,
  closureCertificateDigest: requested.closureCertificateDigest,
  resultFinalizationBarrierRevision: 0,
};
const candidateRow = {
  domain: "iband.movie-mentor.result-candidate-store",
  schema: 2,
  candidateReference: requested.candidateReference,
  executionId: requested.executionId,
  creatorTurnId: requested.creatorTurnId,
  principalId: requested.principalId,
  projectId: requested.projectId,
  reservationId: requested.reservationId,
  requestDigest: requested.requestDigest,
  resultDigest,
  resultPayload: stable(payload),
  stagedFromLeaseGeneration: 4,
  stagedFromLeaseReference: "lease-dup",
  stagedFromFencingToken: "fence-dup",
  creatorStateRevision: 3,
  creatorStateGeneration: 2,
  creatorStateFingerprint: "state-fingerprint-dup",
  creatorStateOwnershipRef: "ownership-dup",
  creatorStateOwnershipRevision: 1,
  stagedAt: "2033-12-31T23:59:59.000Z",
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
  async create() {
    createCalls += 1;
    canonicalRow = clone(winner);
    const error = new Error("duplicate canonical winner");
    error.code = 11000;
    throw error;
  },
};

const executionCollection = {
  async findOne() {
    executionReads += 1;
    return clone(executionRow);
  },
  async updateOne(filter, update) {
    barrierWrites += 1;
    assert.equal(filter.executionId, requested.executionId);
    assert.equal(filter.phase, "closed");
    assert.equal(filter.providerEffectRealityRevision, 11);
    executionRow = {
      ...executionRow,
      ...clone(update.$set),
      resultFinalizationBarrierRevision: executionRow.resultFinalizationBarrierRevision + 1,
    };
    return { matchedCount: 1, modifiedCount: 1 };
  },
};

const candidateCollection = {
  async findOne() {
    candidateReads += 1;
    return clone(candidateRow);
  },
};

const startSession = async () => ({
  async withTransaction(fn) { return fn(); },
  async endSession() { sessionsEnded += 1; },
});

const store = createMovieMentorCanonicalResultMongoStore({
  mongoModel,
  executionCollection,
  candidateCollection,
  startSession,
  readIndexes: async () => indexes,
});

const recovered = await store.commit(requested, { expectedProviderEffectRealityRevision: 11 });

assert.equal(recovered.resultReference, "canonical-winner", "duplicate-key recovery must converge on the durable winner");
assert.equal(recovered.candidateReference, requested.candidateReference);
assert.equal(recovered.resultDigest, resultDigest);
assert.equal(createCalls, 1, "recovery must not attempt a second canonical insert after discovering the winner");
assert.equal(barrierWrites, 1, "the recovered winner may acquire FINALIZED authority exactly once");
assert.equal(executionRow.phase, "finalized");
assert.equal(executionRow.finalizedResultReference, "canonical-winner");
assert.equal(executionRow.finalizedCandidateReference, requested.candidateReference);
assert.equal(executionRow.finalizedResultDigest, resultDigest);
assert.equal(executionRow.resultFinalizationBarrierRevision, 1);
assert.ok(executionReads >= 2, "recovery must re-read execution authority before returning the winner");
assert.ok(candidateReads >= 2, "recovery must revalidate candidate lineage before returning the winner");
assert.equal(sessionsEnded, 2, "both the losing transaction and recovery transaction must close their sessions");

console.log("✓ duplicate-key loser converges on the durable canonical winner");
console.log("✓ winner is revalidated against current execution and candidate authority before FINALIZED");
console.log("✓ recovery performs no second canonical insert and advances finalization exactly once");
console.log("LAW: DUPLICATE IDENTITY MAY REVEAL A WINNER; IT MAY NOT BORROW FINALIZATION AUTHORITY.");
console.log("Movie Mentor canonical result duplicate-key recovery authority: GREEN");
