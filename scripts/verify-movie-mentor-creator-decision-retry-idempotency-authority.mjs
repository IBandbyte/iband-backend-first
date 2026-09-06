import assert from "node:assert/strict";
import {
  buildCreatorDecisionCandidate,
  commitCreatorDecision,
} from "../ai/MovieMentorCreatorDecisionAuthority.js";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";

console.log("ROUND SEVEN — creator-decision retry idempotency authority torture");

const projectId = "project-retry-1";
const creatorSessionId = "session-retry-1";
const creatorTurnId = "turn-retry-1";
const creatorMessage = "Yes, do that.";

const semanticIntelligence = {
  continuationReferences: [
    {
      status: "resolved",
      expression: "that",
      type: "prior-mentor-proposal",
      resolvedValue: { recommendationId: "A", choice: "hidden tunnel" },
      source: "project-memory",
    },
  ],
  understoodContext: [],
};

let durable = {
  projectId,
  creatorSessionId,
  revision: 7,
  revisionAuthorityReference: "rev-7",
  creatorStateGeneration: 3,
  creatorStateFingerprint: "state-3",
  creatorAuthorityReference: "authority-3",
  snapshotReference: "snapshot-7",
  creatorConfirmedContext: [],
  projectJourney: null,
  memoryContext: null,
  responseBlueprint: null,
  communicationPlan: null,
  capturedAt: new Date().toISOString(),
};

const read = async () => structuredClone(durable);
const write = async (next, { expectedRevision } = {}) => {
  assert.equal(durable.revision, expectedRevision, "test store preserves optimistic revision semantics");
  durable = structuredClone(next);
  return structuredClone(durable);
};

const creatorStateMutationAuthority = Object.freeze({
  domain: "iband.movie-mentor.creator-state-mutation-authority",
  schema: 1,
  principalId: "creator-retry-1",
  projectId,
  async assertCurrentMutation(target = {}) {
    return Object.freeze({
      domain: "iband.movie-mentor.creator-state-mutation-proof",
      schema: 1,
      authorized: true,
      currentOwnershipVerified: true,
      principalId: "creator-retry-1",
      projectId,
      ownershipRef: "ownership-retry-1",
      ownershipRevision: 1,
      authorizationSource: "test-current-owner",
      source: target.source,
      expectedRevision: target.expectedRevision,
      revision: target.revision,
      creatorStateGeneration: target.creatorStateGeneration,
      creatorStateFingerprint: target.creatorStateFingerprint,
    });
  },
});

function candidateForSameLogicalTurn() {
  const built = buildCreatorDecisionCandidate({
    creatorMessage,
    semanticIntelligence,
    projectId,
    actorRole: "creator",
    creatorTurnId,
  });
  assert.equal(built.status, "candidate");
  return built.candidate;
}

const firstCandidate = candidateForSameLogicalTurn();
const first = await commitCreatorDecision(
  {
    candidate: firstCandidate,
    expectedRevision: durable.revision,
    projectId,
    creatorSessionId,
    creatorTurnId,
  },
  {
    readAuthoritativeTurnSource: read,
    applyMovieMentorCreatorStateTransition,
    writeAuthoritativeCreatorState: write,
    creatorStateMutationAuthority,
  },
);

assert.equal(first.status, "committed");
assert.equal(durable.revision, 8);
assert.equal(durable.creatorConfirmedContext.filter((item) => item?.current === true).length, 1);
console.log("✓ first delivery of the stable creator turn commits exactly one creator decision");

// Production retry sequence under test:
// 1. explicit creator decision commits during orchestration;
// 2. later result-candidate staging / acknowledgement fails;
// 3. transport retries the SAME stable creatorTurnId;
// 4. orchestration reaches the same explicit creator decision again.
// The retry must recover/reuse the first durable decision instead of creating a
// second authority event merely because the response did not finish.
const retryCandidate = candidateForSameLogicalTurn();
const beforeRetryRevision = durable.revision;
const beforeRetryGeneration = durable.creatorStateGeneration;
const beforeRetryDecisionIds = durable.creatorConfirmedContext.map((item) => item?.decisionId).filter(Boolean);

const retried = await commitCreatorDecision(
  {
    candidate: retryCandidate,
    expectedRevision: durable.revision,
    projectId,
    creatorSessionId,
    creatorTurnId,
  },
  {
    readAuthoritativeTurnSource: read,
    applyMovieMentorCreatorStateTransition,
    writeAuthoritativeCreatorState: write,
    creatorStateMutationAuthority,
  },
);

assert.equal(
  retried?.idempotent,
  true,
  "retrying the same stable creatorTurnId must return the already-committed creator decision as idempotent durable reality",
);
assert.equal(
  durable.revision,
  beforeRetryRevision,
  "same-turn retry must not advance creator-state revision a second time",
);
assert.equal(
  durable.creatorStateGeneration,
  beforeRetryGeneration,
  "same-turn retry must not advance creator-state generation a second time",
);
assert.deepEqual(
  durable.creatorConfirmedContext.map((item) => item?.decisionId).filter(Boolean),
  beforeRetryDecisionIds,
  "same-turn retry must not manufacture a second creator-decision authority event",
);

console.log("✓ result-delivery retry cannot duplicate an already committed explicit creator decision");
console.log("LAW: RESPONSE FAILURE MAY JUSTIFY RETRY. IT MAY NOT TURN ONE CREATOR ACT INTO TWO DURABLE DECISIONS.");
console.log("ROUND SEVEN creator-decision retry idempotency authority torture: GREEN");
