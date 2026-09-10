import assert from "node:assert/strict";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

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
const candidatePhysicalIndexes=Object.freeze([
  Object.freeze({key:Object.freeze({executionId:1}),unique:true}),
  Object.freeze({key:Object.freeze({candidateReference:1}),unique:true}),
]);
const readCandidateIndexes=async(collectionName)=>{
  assert.equal(collectionName,"movie_mentor_result_candidate");
  return candidatePhysicalIndexes;
};

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
const creatorStateConsumptionProof=Object.freeze({
  domain:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,
  schema:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,
  authorized:true,
  currentOwnershipVerified:true,
  principalId:baseExecution.principalId,
  projectId:baseExecution.projectId,
  ownershipRef:"ownership-warp-43",
  ownershipRevision:7,
  stage:"result-candidate",
  revision:43,
  creatorStateGeneration:21,
  creatorStateFingerprint:"creator-state-warp-43",
  executionId:baseExecution.executionId,
  providerCallId:null,
});

const payload = Object.freeze({ text: "current result" });
const liveStore = createMovieMentorResultCandidateMongoStore({
  mongoModel: createMemoryModel(),
  executionCollection: false,
  readIndexes:readCandidateIndexes,
  now: () => new Date("2031-01-01T00:00:00.000Z"),
  randomId: () => "warp-43-live",
});
const live = await liveStore.stageCandidate({ execution: baseExecution, resultPayload: payload, creatorStateConsumptionProof });
assert.equal(live.executionId, baseExecution.executionId, "current forward-authorized execution plus exact current creator-state proof may stage through the standalone store seam");
assert.equal(live.creatorStateRevision,43);

const noStateProofStore = createMovieMentorResultCandidateMongoStore({
  mongoModel:createMemoryModel(),executionCollection:false,readIndexes:readCandidateIndexes,now:()=>new Date("2031-01-01T00:00:00.500Z"),randomId:()=>"warp-43-no-state-proof",
});
await assert.rejects(
  noStateProofStore.stageCandidate({execution:{...baseExecution,executionId:"execution-warp-43-no-state-proof"},resultPayload:payload}),
  error=>error?.code==="MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_PROOF_REQUIRED",
  "forward execution authority may not borrow missing current creator-state authority at the candidate store",
);

const historicalStore = createMovieMentorResultCandidateMongoStore({
  mongoModel: createMemoryModel(),
  executionCollection: false,
  readIndexes:readCandidateIndexes,
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
  readIndexes:readCandidateIndexes,
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

console.log("✓ current forward execution plus exact current creator-state authority may cross the candidate-store component seam");
console.log("✓ candidate-store seam owns current physical uniqueness readiness before staging");
console.log("✓ missing creator-state proof carries zero candidate-write authority");
console.log("✓ historical authority-issued evidence carries zero forward result-candidate authority");
console.log("✓ absent forward-authority bit fails closed rather than inheriting authorized:true");
console.log("LAW: AUTHORIZED HISTORY ≠ FORWARD EXECUTION AUTHORITY");
console.log("LAW: FORWARD EXECUTION AUTHORITY ≠ CURRENT CREATOR-STATE AUTHORITY");
console.log("LAW: RESULT-CANDIDATE STORE REQUIRES PHYSICAL UNIQUENESS, EXPLICIT CURRENT FORWARD EXECUTION AND CURRENT CREATOR-STATE AUTHORITY");
console.log("Zorg: But the execution is live. Kraken: SO IS THE CREATOR STATE. PROVE BOTH.");
console.log("Gates of Progress result-candidate historical authority isolation: GREEN");