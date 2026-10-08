import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { buildCreatorDecisionCandidate, commitCreatorDecision } from "../ai/MovieMentorCreatorDecisionAuthority.js";
import { bindCreatorDecisionCommitToTurn } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";
import { createMovieMentorCreatorStateMutationAuthority } from "../ai/MovieMentorCreatorStateMutationAuthority.js";
import { readAuthoritativeTurnSource, writeAuthoritativeCreatorState } from "../ai/MovieMentorCreatorStateStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const uri = process.env.MONGO_URI;
assert.match(uri || "", /^mongodb:\/\/127\.0\.0\.1:27017\/iband_real_store_first_commit_court$/, "Only the isolated GitHub Actions MongoDB test database is permitted");
const projectId = "first-commit-takeover-project";
const creatorSessionId = "first-commit-takeover-session";
const creatorTurnId = "first-commit-takeover-turn";
const principalId = "first-commit-takeover-creator";
const initialRevision = 7;
let nextId = 0;
const leaseStore = createMovieMentorInferenceExecutionMongoStore();
const leaseAuthority = createMovieMentorInferenceExecutionLeaseAuthority({
  store: leaseStore, now: () => new Date(), leaseMs: 1200,
  maxProviderCalls: 5, randomId: () => `physical-${++nextId}`,
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
  const reservationId = "reservation-first-commit";
  await mongoose.connection.collection("movie_mentor_inference_spend_reservation").insertOne({
    domain: "iband.movie-mentor.inference-spend", schema: 1, reservationId,
    principalId, projectId, operation: "movie-mentor-turn", status: "reserved",
    executionBindingBarrierRevision: 0,
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
  await new Promise(resolve => setTimeout(resolve, 1800));
  const workerB = await leaseAuthority.acquireExecution({ executionId: workerA.executionId, ownerId: "worker-B" });
  assert.equal(workerB.authorized, true, JSON.stringify(workerB));
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
