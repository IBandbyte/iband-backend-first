import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const projectId = "project-turn-conflict-race";
const principalId = "creator-turn-conflict-race";
const creatorTurnId = "turn-conflict-race";
const freshReservationId = "reservation-loser-fresh";
const winningReservationId = "reservation-winner-existing";

const durable = {
  projectId,
  creatorSessionId: "session-turn-conflict-race",
  revision: 9,
  revisionAuthorityReference: "revision:turn-conflict-race:9",
  creatorStateGeneration: 4,
  creatorStateFingerprint: "c".repeat(64),
  creatorAuthorityReference: "creator-state:turn-conflict-race:g4",
  snapshotReference: "snapshot:turn-conflict-race:r9:g4",
  capturedAt: "2038-01-01T00:00:00.000Z",
  creatorConfirmedContext: [],
  projectJourney: null,
  memoryContext: null,
  responseBlueprint: null,
  communicationPlan: null,
};

let findCalls = 0;
let reserveCalls = 0;
let openExecutionCalls = 0;
let releaseUnboundCalls = 0;
let readReservationCalls = 0;
let acquireCalls = 0;
let providerWorkCalls = 0;
let orchestrationCalls = 0;
let freshReleased = false;

const winningExecution = {
  found: true,
  authorized: true,
  executionId: "execution-winner-existing",
  creatorTurnId,
  principalId,
  projectId,
  reservationId: winningReservationId,
  requestDigest: "winner-request-digest",
  phase: "active",
  ownerId: "winner-owner",
  leaseGeneration: 1,
  leaseReference: "winner-lease",
  fencingToken: "winner-fence",
  leaseExpiresAt: "2099-01-01T00:00:00.000Z",
};

const inferenceSpendAuthority = {
  reserveTurn: async ({ serverAuthority, projectId: requestedProjectId, creatorTurnId: requestedCreatorTurnId }) => {
    reserveCalls += 1;
    assert.equal(serverAuthority?.principalId, principalId);
    assert.equal(requestedProjectId, projectId);
    assert.equal(requestedCreatorTurnId, creatorTurnId);
    return {
      authorized: true,
      reservationId: freshReservationId,
      principalId,
      projectId,
      operation: "movie-mentor-turn",
      units: 1,
      status: "reserved",
    };
  },
  readReservation: async ({ reservationId, principalId: requestedPrincipalId, projectId: requestedProjectId }) => {
    readReservationCalls += 1;
    assert.equal(freshReleased, true, "losing fresh reservation must be released before winner rehydration");
    assert.equal(reservationId, winningReservationId);
    assert.equal(requestedPrincipalId, principalId);
    assert.equal(requestedProjectId, projectId);
    return {
      authorized: false,
      rehydrated: true,
      reservationId: winningReservationId,
      principalId,
      projectId,
      operation: "movie-mentor-turn",
      units: 1,
      status: "released",
    };
  },
};

const forbiddenProvider = async () => {
  providerWorkCalls += 1;
  throw new Error("invalid winning reservation must stop before provider work");
};

const inferenceExecutionAuthority = {
  findExecutionByCreatorTurn: async () => {
    findCalls += 1;
    return findCalls === 1 ? { found: false, authorized: false } : structuredClone(winningExecution);
  },
  openExecution: async () => {
    openExecutionCalls += 1;
    const error = new Error("another runtime won creator-turn execution creation");
    error.code = "MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";
    throw error;
  },
  acquireExecution: async () => {
    acquireCalls += 1;
    throw new Error("INVALID_RESERVATION_CROSSED_ACQUIRE_BOUNDARY");
  },
  assertFence: forbiddenProvider,
  claimProviderCall: forbiddenProvider,
  beginProviderDispatch: forbiddenProvider,
  assertProviderDispatch: forbiddenProvider,
  contributeProviderEffectEvidence: forbiddenProvider,
  beginExecutionClosing: forbiddenProvider,
  reconcileExecutionClosure: forbiddenProvider,
  assertCurrentExecutionClosure: forbiddenProvider,
  stageResultCandidate: forbiddenProvider,
  readResultCandidate: async () => null,
  commitCanonicalResult: forbiddenProvider,
  readCanonicalResult: async () => ({ authorized: false, committed: false }),
};

const inferenceSettlementAuthority = {
  reconcile: forbiddenProvider,
  releaseUnclaimed: forbiddenProvider,
  releaseUnbound: async ({ reservationId, principalId: requestedPrincipalId, projectId: requestedProjectId }) => {
    releaseUnboundCalls += 1;
    assert.equal(reservationId, freshReservationId);
    assert.equal(requestedPrincipalId, principalId);
    assert.equal(requestedProjectId, projectId);
    freshReleased = true;
    return {
      authorized: true,
      released: true,
      outcome: "released",
      reservationId,
      principalId: requestedPrincipalId,
      projectId: requestedProjectId,
    };
  },
};

await assert.rejects(
  () => runMovieMentorTurn(
    {
      projectId,
      creatorSessionId: durable.creatorSessionId,
      creatorTurnId,
      message: "Race the same creator turn while another runtime wins execution creation.",
    },
    {
      serverAuthority: { authenticated: true, projectAuthorized: true, principalId, projectId },
      inferenceSpendAuthority,
      inferenceExecutionAuthority,
      inferenceSettlementAuthority,
      createExecutionOwnerId: () => "loser-owner",
      readAuthoritativeTurnSource: async () => structuredClone(durable),
      readAuthoritativeRevision: async () => ({ revision: durable.revision, reference: durable.revisionAuthorityReference }),
      readAuthoritativeCreatorState: async () => ({
        generation: durable.creatorStateGeneration,
        fingerprint: durable.creatorStateFingerprint,
        authorityReference: durable.creatorAuthorityReference,
        snapshotReference: durable.snapshotReference,
      }),
      orchestrateTurn: async () => {
        orchestrationCalls += 1;
        throw new Error("invalid winning reservation must stop before orchestration");
      },
    },
  ),
  (error) => error?.code === "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_INVALID",
  "after a turn-identity conflict, an active winning execution must not be acquired unless its own reservation rehydrates as current reserved spend authority",
);

assert.equal(reserveCalls, 1);
assert.equal(openExecutionCalls, 1);
assert.equal(releaseUnboundCalls, 1);
assert.equal(findCalls, 2);
assert.equal(readReservationCalls, 1);
assert.equal(acquireCalls, 0, "invalid winner spend authority must stop before execution acquisition");
assert.equal(providerWorkCalls, 0, "invalid winner spend authority must stop before provider authority");
assert.equal(orchestrationCalls, 0, "invalid winner spend authority must stop before orchestration");

console.log("GREEN: turn-conflict recovery validates the winning execution reservation before acquisition or provider work.");
console.log("LAW: A CONCURRENT EXECUTION WINNER MAY NOT BORROW AUTHORITY FROM THE LOSING FRESH RESERVATION.");
