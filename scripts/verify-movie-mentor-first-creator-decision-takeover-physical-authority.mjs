import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildCreatorDecisionCandidate, commitCreatorDecision } from "../ai/MovieMentorCreatorDecisionAuthority.js";
import { bindCreatorDecisionCommitToTurn } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";
import { createMovieMentorCreatorStateMutationAuthority } from "../ai/MovieMentorCreatorStateMutationAuthority.js";
import { readAuthoritativeTurnSource, writeAuthoritativeCreatorState } from "../ai/MovieMentorCreatorStateStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const uri = process.env.MONGO_URI;
assert.match(uri || "", /^mongodb:\/\/127\.0\.0\.1:27017\/iband_first_commit_takeover_court$/, "Only the isolated GitHub Actions MongoDB test database is permitted");
const projectId = "first-commit-takeover-project";
const creatorSessionId = "first-commit-takeover-session";
const creatorTurnId = "first-commit-takeover-turn";
const principalId = "first-commit-takeover-creator";
const initialRevision = 7;
let clock = new Date("2030-01-01T00:00:00.000Z");
let nextId = 0;
let executionRow = null;
const copy = (value) => value == null ? null : structuredClone(value);
const leaseStore = {
  async readExecution(id) { return executionRow?.executionId === id ? copy(executionRow) : null; },
  async readExecutionByCreatorTurn({ principalId: principal, projectId: project, creatorTurnId: turn } = {}) {
    return executionRow?.principalId === principal && executionRow?.projectId === project && executionRow?.creatorTurnId === turn ? copy(executionRow) : null;
  },
  async createExecution(next) {
    if (executionRow) return null;
    executionRow = copy(next);
    return copy(executionRow);
  },
  async replaceExecution(next, expected = {}) {
    if (!executionRow || executionRow.executionId !== next.executionId || executionRow.phase !== expected.expectedPhase || executionRow.leaseGeneration !== expected.expectedLeaseGeneration || executionRow.leaseReference !== expected.expectedLeaseReference) return null;
    if (expected.requireDurablyExpired && new Date(executionRow.leaseExpiresAt).getTime() > clock.getTime()) return null;
    executionRow = copy(next);
    return copy(executionRow);
  },
  async claimProviderCall() { throw new Error("This court must not dispatch providers"); },
};
const leaseAuthority = createMovieMentorInferenceExecutionLeaseAuthority({
  store: leaseStore, now: () => new Date(clock), leaseMs: 1000,
  maxProviderCalls: 5, randomId: () => `court-${++nextId}`,
});
const initialAuthorization = Object.freeze({
  authorized: true, principalId, projectId, ownershipRef: "ownership-first-commit",
  ownershipRevision: 1, authorizationSource: "court-current-owner",
});
let ownershipChecks = 0;
const requestAuthority = {
  async authorize({ projectId: requestedProject }) {
    assert.equal(requestedProject, projectId);
    ownershipChecks++;
    return initialAuthorization;
  },
};
const creatorStateMutationAuthority = createMovieMentorCreatorStateMutationAuthority({
  request: Object.freeze({ court: true }), authorization: initialAuthorization, requestAuthority,
});
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
try {
  const collection = mongoose.connection.collection("movie_mentor_creator_state");
  await collection.createIndex({ projectId: 1 }, { unique: true, partialFilterExpression: { projectId: { $type: "string" } } });
  await collection.insertOne({
    projectId, creatorSessionId, revision: initialRevision, revisionAuthorityReference: "revision-7",
    creatorStateGeneration: 3, creatorStateFingerprint: "fingerprint-3",
    creatorAuthorityReference: "authority-3", snapshotReference: "snapshot-7",
    creatorConfirmedContext: [], projectJourney: null, memoryContext: null,
    responseBlueprint: null, communicationPlan: null, compensationBarrierRevision: 0,
    capturedAt: new Date(),
  });
  const workerA = await leaseAuthority.openExecution({
    creatorTurnId, principalId, projectId, reservationId: "reservation-first-commit",
    requestDigest: "sha256:first-commit-takeover", ownerId: "worker-A",
  });
  assert.equal(workerA.authorized, true);
  assert.equal((await leaseAuthority.assertFence(workerA)).authorized, true);
  const candidateResult = buildCreatorDecisionCandidate({
    creatorMessage: "Yes, do that.", projectId, actorRole: "creator",
    semanticIntelligence: {
      continuationReferences: [{
        status: "resolved", expression: "that", type: "prior-mentor-proposal",
        resolvedValue: { recommendationId: "A", choice: "hidden tunnel" },
        source: "project-memory",
      }],
      understoodContext: [],
    },
  });
  assert.equal(candidateResult.status, "candidate");
  assert.equal((await readAuthoritativeTurnSource({ projectId })).revision, initialRevision);
  // Controlled handoff at the production orchestrator's post-synthesis/pre-commit boundary.
  clock = new Date(clock.getTime() + 1001);
  const workerB = await leaseAuthority.acquireExecution({ executionId: workerA.executionId, ownerId: "worker-B" });
  assert.equal(workerB.authorized, true);
  assert.equal(workerB.leaseGeneration, workerA.leaseGeneration + 1);
  assert.equal((await leaseAuthority.assertFence(workerA)).authorized, false);
  assert.equal((await leaseAuthority.assertFence(workerB)).authorized, true);
  const commit = bindCreatorDecisionCommitToTurn({ creatorTurnId }, { commitCreatorDecision });
  let outcome = null;
  let error = null;
  try {
    outcome = await commit({
      candidate: candidateResult.candidate, expectedRevision: initialRevision,
      projectId, creatorSessionId,
    }, {
      readAuthoritativeTurnSource, writeAuthoritativeCreatorState,
      creatorStateMutationAuthority,
    });
  } catch (caught) { error = caught; }
  const durable = await readAuthoritativeTurnSource({ projectId });
  console.log(JSON.stringify({
    court: "stale-first-creator-decision-commit-after-lease-takeover",
    workerAStillAuthorized: (await leaseAuthority.assertFence(workerA)).authorized,
    workerBStillAuthorized: (await leaseAuthority.assertFence(workerB)).authorized,
    ownershipChecks, commitStatus: outcome?.status ?? null,
    commitErrorCode: error?.code ?? null,
    durableRevision: durable.revision,
    durableCreatorTurnDecisionCount: durable.creatorConfirmedContext.filter((item) => item?.creatorTurnId === creatorTurnId).length,
  }));
  assert.ok(ownershipChecks >= 1, "Production mutation authority must freshly check current ownership");
  assert.equal(durable.revision, initialRevision, "FENCING RED: a stale execution worker must not publish its first durable creator decision");
  assert.equal(durable.creatorConfirmedContext.filter((item) => item?.creatorTurnId === creatorTurnId).length, 0);
  assert.equal(outcome?.status, undefined);
  console.log("PASS: stale worker was fenced before the first durable creator decision");
} finally {
  await mongoose.disconnect();
}
