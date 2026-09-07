import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultMongoStore } from "../ai/MovieMentorCanonicalResultMongoStore.js";

console.log("5A.28 — legacy canonical candidate finalization authority torture");

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

const payload = { success: true, mentorResponse: { text: "Historical canonical history must not erase current candidate lineage." } };
const resultDigest = digest(payload);
const currentCandidateReference = "candidate-current-2";
const record = {
  resultReference: "legacy-result-1",
  candidateReference: currentCandidateReference,
  executionId: "execution-legacy-1",
  creatorTurnId: "turn-legacy-1",
  principalId: "creator-1",
  projectId: "project-1",
  reservationId: "reservation-1",
  requestDigest: "request-1",
  closureReference: "closure-1",
  closureCertificateDigest: "closure-digest-1",
  resultDigest,
  resultPayload: stable(payload),
  committedAt: "2032-01-01T00:00:00.000Z",
};

let canonicalRow = {
  domain: "iband.movie-mentor.canonical-result-store",
  schema: 1,
  resultReference: record.resultReference,
  executionId: record.executionId,
  creatorTurnId: record.creatorTurnId,
  principalId: record.principalId,
  projectId: record.projectId,
  reservationId: record.reservationId,
  requestDigest: record.requestDigest,
  closureReference: record.closureReference,
  closureCertificateDigest: record.closureCertificateDigest,
  resultDigest,
  resultPayload: stable(payload),
  committedAt: record.committedAt,
};

const model = {
  findOne(query) {
    return {
      session() { return this; },
      lean() { return this; },
      async exec() {
        if (query.executionId && query.executionId !== canonicalRow.executionId) return null;
        if (query.principalId && query.principalId !== canonicalRow.principalId) return null;
        if (query.projectId && query.projectId !== canonicalRow.projectId) return null;
        if (query.creatorTurnId && query.creatorTurnId !== canonicalRow.creatorTurnId) return null;
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
  providerEffectRealityRevision: 9,
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
let finalizationSet = null;
const executionCollection = {
  async findOne() { return structuredClone(executionRow); },
  async updateOne(filter, update) {
    assert.equal(filter.executionId, record.executionId);
    assert.equal(filter.phase, "closed");
    assert.equal(filter.providerEffectRealityRevision, 9);
    finalizationSet = structuredClone(update.$set);
    executionRow = {
      ...executionRow,
      ...finalizationSet,
      resultFinalizationBarrierRevision: executionRow.resultFinalizationBarrierRevision + 1,
    };
    return { matchedCount: 1 };
  },
};
const candidateCollection = {
  async findOne(query) {
    assert.equal(query.executionId, record.executionId);
    assert.equal(query.candidateReference, currentCandidateReference);
    return {
      domain: "iband.movie-mentor.result-candidate-store",
      schema: 2,
      candidateReference: currentCandidateReference,
      executionId: record.executionId,
      creatorTurnId: record.creatorTurnId,
      principalId: record.principalId,
      projectId: record.projectId,
      reservationId: record.reservationId,
      requestDigest: record.requestDigest,
      resultDigest,
      resultPayload: stable(payload),
      creatorStateRevision: 12,
      creatorStateGeneration: 4,
      creatorStateFingerprint: "fingerprint-4",
      creatorStateOwnershipRef: "ownership-1",
      creatorStateOwnershipRevision: 1,
    };
  },
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

const committed = await store.commit(record, { expectedProviderEffectRealityRevision: 9 });

assert.equal(
  committed.candidateReference,
  currentCandidateReference,
  "legacy canonical convergence must return the exact current durable candidate lineage it validated",
);
assert.equal(
  finalizationSet?.finalizedCandidateReference,
  currentCandidateReference,
  "CLOSED -> FINALIZED must never erase candidate lineage merely because the pre-existing canonical row predates candidateReference",
);
assert.equal(
  executionRow.phase,
  "finalized",
  "valid historical canonical convergence must still advance CLOSED -> FINALIZED exactly once",
);

console.log("✓ legacy schema-1 canonical history cannot launder a blank candidate reference through current finalization");
console.log("LAW: HISTORY MAY SURVIVE SCHEMA EVOLUTION. CURRENT FINALIZATION AUTHORITY MAY NOT ERASE THE LINEAGE IT JUST PROVED.");
