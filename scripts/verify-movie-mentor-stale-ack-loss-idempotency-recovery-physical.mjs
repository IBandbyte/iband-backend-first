import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorInferenceExecutionMongoStore } from "../ai/MovieMentorInferenceExecutionMongoStore.js";
import { buildCreatorDecisionCandidate, commitCreatorDecision } from "../ai/MovieMentorCreatorDecisionAuthority.js";
import { bindCreatorDecisionCommitToTurn } from "../ai/MovieMentorCreatorStateConsumptionRuntime.js";
import { createMovieMentorCreatorStateMutationAuthority } from "../ai/MovieMentorCreatorStateMutationAuthority.js";
import { readAuthoritativeTurnSource, writeAuthoritativeCreatorState } from "../ai/MovieMentorCreatorStateStore.js";
import { createMovieMentorInferenceExecutionLeaseAuthority } from "../ai/MovieMentorInferenceExecutionLeaseAuthority.js";

const uri = process.env.MONGO_URI;
assert.match(uri || "", /^mongodb:\/\/127\.0\.0\.1:27017\/iband_stale_idempotency_recovery_court$/, "Only the isolated GitHub Actions MongoDB test database is permitted");
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
  // New court: real writer commits outside any transaction, then simulates an
  // acknowledged-write response loss. The production commit's same-turn
  // idempotency recovery must not grant a revoked worker success.
  const commit = bindCreatorDecisionCommitToTurn({ creatorTurnId }, { commitCreatorDecision });
  let writerCalled = 0;
  let outcome = null;
  let error = null;
  const ackLostWriter = async (state, options) => {
    writerCalled++;
    await writeAuthoritativeCreatorState(state, options);
    const failure = new Error("simulated acknowledgement loss after durable write");
    failure.code = "COURT_ACK_LOST_AFTER_WRITE";
    throw failure;
  };
  try {
    outcome = await commit({
      candidate: candidateResult.candidate, expectedRevision: initialRevision,
      projectId, creatorSessionId,
    }, {
      readAuthoritativeTurnSource,
      writeAuthoritativeCreatorState: ackLostWriter,
      creatorStateMutationAuthority,
    });
  } catch (caught) { error = caught; }
  const durable = await readAuthoritativeTurnSource({ projectId });
  const aFenced = (await leaseAuthority.assertFence(workerA)).authorized === false;
  const bAuthorized = (await leaseAuthority.assertFence(workerB)).authorized === true;
  const facts = {
    court: "stale-creator-decision-ack-loss-idempotency-recovery",
    classification: "real production commit, transition and writer; synthetic post-write ACK loss; isolated MongoDB",
    workerARevoked: aFenced, workerBCurrent: bAuthorized,
    writerCalled, ownershipChecks,
    commitStatus: outcome?.status ?? null,
    idempotent: outcome?.idempotent ?? null,
    errorCode: error?.code ?? null,
    durableRevision: durable.revision,
    durableDecisionCount: durable.creatorConfirmedContext.filter(item => item?.creatorTurnId === creatorTurnId).length,
  };
  console.log(JSON.stringify(facts));
  assert.equal(aFenced, true);
  assert.equal(bAuthorized, true);
  assert.equal(writerCalled, 1);
  assert.equal(durable.revision, initialRevision,
    "PHYSICAL RED: revoked worker published durable creator truth before ACK-loss recovery");
  assert.equal(outcome, null,
    "RECOVERY RED: revoked worker received a successful same-turn idempotency result");
  console.log("PASS: stale execution was fenced from durable creator truth and recovery");
} finally {
  await mongoose.disconnect();
}
