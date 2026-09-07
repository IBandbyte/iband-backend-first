import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";
import { getMovieMentorResultCandidateMongoStoreStatus } from "../ai/MovieMentorResultCandidateMongoStore.js";

console.log("5A.28 — canonical result current candidate schema authority torture");

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
};
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const candidateStatus = getMovieMentorResultCandidateMongoStoreStatus();
assert.equal(candidateStatus.schema, 2, "verifier must exercise the schema emitted by the current durable result-candidate store");

const payload = { success: true, mentorResponse: { text: "Current candidate reality must survive canonicalization." } };
const resultDigest = digest(payload);
const record = {
  resultReference: "canonical-result-schema-2",
  candidateReference: "candidate-schema-2",
  executionId: "execution-schema-2",
  creatorTurnId: "turn-schema-2",
  principalId: "creator-schema-2",
  projectId: "project-schema-2",
  reservationId: "reservation-schema-2",
  requestDigest: "request-schema-2",
  closureReference: "closure-schema-2",
  closureCertificateDigest: "closure-digest-schema-2",
  resultDigest,
  resultPayload: stable(payload),
  committedAt: "2032-01-01T00:00:00.000Z",
};

let canonicalRow = null;
const model = {
  findOne(query) {
    return {
      session() { return this; },
      lean() { return this; },
      async exec() {
        if (!canonicalRow) return null;
        if (query.executionId && canonicalRow.executionId !== query.executionId) return null;
        if (query.principalId && canonicalRow.principalId !== query.principalId) return null;
        if (query.projectId && canonicalRow.projectId !== query.projectId) return null;
        if (query.creatorTurnId && canonicalRow.creatorTurnId !== query.creatorTurnId) return null;
        return structuredClone(canonicalRow);
      },
    };
  },
  async create(rows) {
    canonicalRow = structuredClone(rows[0]);
    return [structuredClone(canonicalRow)];
  },
};

let executionRow = {
  domain: "iband.movie-mentor.inference-execution-store",
  schema: 6,
  phase: "closed",
  providerEffectRealityRevision: 7,
  executionId: record.executionId,
  creatorTurnId: record.creatorTurnId,
  principalId: record.principalId,
  projectId: record.projectId,
  reservationId: record.reservationId,
  requestDigest: record.requestDigest,
  closureReference: record.closureReference,
  closureCertificateDigest: record.closureCertificateDigest,
  resultFinalizationBarrierRevision: 0,
};
const candidateRow = {
  domain: "iband.movie-mentor.result-candidate-store",
  schema: candidateStatus.schema,
  candidateReference: record.candidateReference,
  executionId: record.executionId,
  creatorTurnId: record.creatorTurnId,
  principalId: record.principalId,
  projectId: record.projectId,
  reservationId: record.reservationId,
  requestDigest: record.requestDigest,
  resultDigest,
  resultPayload: stable(payload),
};
const executionCollection = {
  async findOne() { return structuredClone(executionRow); },
  async updateOne(filter, update) {
    assert.equal(filter.executionId, record.executionId);
    assert.equal(filter.phase, "closed");
    assert.equal(filter.providerEffectRealityRevision, 7);
    executionRow = {
      ...executionRow,
      ...structuredClone(update.$set),
      resultFinalizationBarrierRevision: executionRow.resultFinalizationBarrierRevision + 1,
    };
    return { matchedCount: 1 };
  },
};
const candidateCollection = {
  async findOne() { return structuredClone(candidateRow); },
};
const session = {
  async withTransaction(fn) { return fn(); },
  async endSession() {},
};

const store = createMovieMentorCanonicalResultMongoStore({
  mongoModel: model,
  executionCollection,
  candidateCollection,
  startSession: async () => session,
});

const committed = await store.commit(record, { expectedProviderEffectRealityRevision: 7 });
assert.equal(committed.resultReference, record.resultReference, "current schema-2 candidate must cross canonical store validation and persist the exact canonical result");
assert.equal(committed.candidateReference, record.candidateReference, "canonical result must preserve the exact current candidate lineage");
assert.equal(executionRow.phase, "finalized", "current schema-2 candidate must permit the atomic CLOSED -> FINALIZED transition");
assert.equal(executionRow.finalizedCandidateReference, record.candidateReference, "finalized execution must bind the exact schema-2 candidate reference");
assert.equal(executionRow.resultFinalizationBarrierRevision, 1, "canonical finalization must advance its store-owned serialization barrier exactly once");

console.log("✓ current durable schema-2 candidate crosses the canonical result store boundary");
console.log("✓ canonical persistence and CLOSED -> FINALIZED binding preserve exact candidate lineage");
console.log("LAW: CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED");
console.log("5A.28 canonical result current candidate schema authority torture: GREEN");
