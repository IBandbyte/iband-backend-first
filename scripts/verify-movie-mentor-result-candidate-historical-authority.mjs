import assert from "node:assert/strict";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";

function createMemoryModel() {
  const rows = new Map();
  const query = (row) => ({ lean: () => ({ exec: async () => row ? structuredClone(row) : null }) });
  return {
    findOne({ executionId } = {}) { return query(rows.get(executionId) || null); },
    async create(record) {
      const value = Array.isArray(record) ? record[0] : record;
      rows.set(value.executionId, structuredClone(value));
      return structuredClone(value);
    },
  };
}

const baseExecution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  executionId: "execution-warp-43",
  creatorTurnId: "turn-warp-43",
  principalId: "creator-warp-43",
  projectId: "project-warp-43",
  reservationId: "reservation-warp-43",
  requestDigest: "digest-warp-43",
  ownerId: "worker-warp-43",
  leaseGeneration: 7,
  leaseReference: "lease-warp-43",
  fencingToken: "fence-warp-43",
});

const payload = Object.freeze({ text: "current result" });
const liveStore = createMovieMentorResultCandidateMongoStore({
  mongoModel: createMemoryModel(),
  executionCollection: false,
  now: () => new Date("2031-01-01T00:00:00.000Z"),
  randomId: () => "warp-43-live",
});
const live = await liveStore.stageCandidate({ execution: baseExecution, resultPayload: payload });
assert.equal(live.executionId, baseExecution.executionId, "current forward-authorized execution may stage through the standalone store seam");

const historicalStore = createMovieMentorResultCandidateMongoStore({
  mongoModel: createMemoryModel(),
  executionCollection: false,
  now: () => new Date("2031-01-01T00:00:01.000Z"),
  randomId: () => "warp-43-history",
});
const historical = Object.freeze({ ...baseExecution, executionId: "execution-warp-43-history", executionAuthorized: false });
await assert.rejects(
  historicalStore.stageCandidate({ execution: historical, resultPayload: payload }),
  error => error?.code === "MOVIE_MENTOR_RESULT_CANDIDATE_EXECUTION_AUTHORITY_REQUIRED",
  "genuine historical execution evidence must carry zero forward authority at the candidate-store component boundary",
);

const absentForwardStore = createMovieMentorResultCandidateMongoStore({
  mongoModel: createMemoryModel(),
  executionCollection: false,
  now: () => new Date("2031-01-01T00:00:02.000Z"),
  randomId: () => "warp-43-absent-forward",
});
const { executionAuthorized: _omitted, ...withoutForwardAuthority } = baseExecution;
const absentForward = Object.freeze({ ...withoutForwardAuthority, executionId: "execution-warp-43-absent-forward" });
await assert.rejects(
  absentForwardStore.stageCandidate({ execution: absentForward, resultPayload: payload }),
  error => error?.code === "MOVIE_MENTOR_RESULT_CANDIDATE_EXECUTION_AUTHORITY_REQUIRED",
  "absence of explicit forward execution authority must fail closed",
);

console.log("✓ current forward execution authority may cross the candidate-store component seam");
console.log("✓ historical authority-issued evidence carries zero forward result-candidate authority");
console.log("✓ absent forward-authority bit fails closed rather than inheriting authorized:true");
console.log("LAW: AUTHORIZED HISTORY ≠ FORWARD EXECUTION AUTHORITY");
console.log("LAW: RESULT-CANDIDATE STORE REQUIRES EXPLICIT CURRENT FORWARD EXECUTION AUTHORITY");
console.log("Zorg: But authorized is true. Kraken: YOUR LIBRARY CARD IS ALSO REAL. YOU STILL CAN'T USE IT TO LAUNCH A MISSILE.");
console.log("Gates of Progress result-candidate historical authority isolation: GREEN");
