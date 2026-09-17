import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const creatorTurnId = "turn-conflict-winner-binding";
const principalId = "creator-conflict-winner-binding";
const projectId = "project-conflict-winner-binding";
const losingReservationId = "reservation-loser";
const winningReservationId = "reservation-winner";
const winningExecutionId = "execution-winner";

let findCalls = 0;
let reserveCalls = 0;
let openCalls = 0;
let releaseUnboundCalls = 0;
let releaseUnclaimedCalls = 0;
let readReservationCalls = 0;
let acquireCalls = 0;
let claimCalls = 0;
let providerCalls = 0;
let orchestrationCalls = 0;

const winner = Object.freeze({
  found: true,
  authorized: true,
  phase: "active",
  executionId: winningExecutionId,
  creatorTurnId,
  principalId,
  projectId,
  reservationId: winningReservationId,
  requestDigest: "winner-digest",
});

const acquiredWinner = Object.freeze({ ...winner, ownerId: "winner-retry-owner" });

const fail = (message) => { throw new Error(message); };

await assert.rejects(
  () => runMovieMentorTurn(
    { projectId, creatorTurnId, message: "Continue my movie." },
    {
      serverAuthority: { authenticated: true, projectAuthorized: true, principalId, projectId },
      readAuthoritativeTurnSource: async () => ({
        projectId,
        creatorSessionId: "session-conflict-winner-binding",
        revision: 1,
        revisionAuthorityReference: "revision-1",
        creatorStateGeneration: 1,
        creatorStateFingerprint: "fingerprint-1",
        creatorAuthorityReference: "creator-authority-1",
        snapshotReference: "snapshot-1",
        capturedAt: "2026-09-17T00:00:00.000Z",
        creatorConfirmedContext: [],
      }),
      readAuthoritativeRevision: async () => ({ authorized: true, revision: 1 }),
      readAuthoritativeCreatorState: async () => ({ authorized: true }),
      createExecutionOwnerId: () => "winner-retry-owner",
      inferenceSpendAuthority: {
        reserveTurn: async () => {
          reserveCalls += 1;
          return { authorized: true, status: "reserved", reservationId: losingReservationId, principalId, projectId, creatorTurnId };
        },
        readReservation: async ({ reservationId }) => {
          readReservationCalls += 1;
          assert.equal(reservationId, winningReservationId, "winner execution must rehydrate its own reservation");
          return { authorized: true, status: "reserved", reservationId: winningReservationId, principalId, projectId, creatorTurnId };
        },
      },
      inferenceSettlementAuthority: {
        reconcile: async () => fail("SETTLEMENT_CROSSED_UNFINISHED_TEST"),
        releaseUnclaimed: async ({ executionId }) => {
          releaseUnclaimedCalls += 1;
          assert.equal(executionId, winningExecutionId, "cleanup after the deliberate stop must target the acquired winning execution");
          return { authorized: true, released: true, outcome: "released", executionId, principalId, projectId };
        },
        releaseUnbound: async ({ reservationId }) => {
          releaseUnboundCalls += 1;
          assert.equal(reservationId, losingReservationId, "only the losing fresh reservation may be released as unbound");
          return { authorized: true, released: true, outcome: "released", reservationId, principalId, projectId };
        },
      },
      inferenceExecutionAuthority: {
        findExecutionByCreatorTurn: async () => {
          findCalls += 1;
          return findCalls <= 2 ? { found: false, authorized: false } : winner;
        },
        openExecution: async () => {
          openCalls += 1;
          const error = new Error("another runtime won this creator turn");
          error.code = "MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";
          throw error;
        },
        acquireExecution: async ({ executionId }) => {
          acquireCalls += 1;
          assert.equal(executionId, winningExecutionId, "runtime must acquire the winning execution");
          return acquiredWinner;
        },
        assertFence: async () => acquiredWinner,
        claimProviderCall: async ({ execution }) => {
          claimCalls += 1;
          assert.equal(execution.executionId, winningExecutionId, "provider claim must bind winning execution");
          assert.equal(execution.reservationId, winningReservationId, "provider claim must bind winner reservation, never losing reservation");
          return {
            authorized: true,
            dispatchAuthorized: true,
            providerCallId: "provider-call-winner",
            executionId: winningExecutionId,
            creatorTurnId,
            principalId,
            projectId,
            reservationId: winningReservationId,
            slotId: "semantic",
            task: "movie-mentor-semantic",
          };
        },
        bindProviderReconstructionInput: async () => ({ authorized: true, inputBound: true }),
        beginProviderDispatch: async ({ providerCall }) => ({ dispatchAuthorized: true, providerOperationIdentity: { providerOperationId: providerCall.providerCallId, executionId: winningExecutionId, slotId: "semantic", task: "movie-mentor-semantic", providerTarget: { dispatchModel: "test-model" }, currentModelVerified: true, providerModel: "test-model" } }),
        assertProviderDispatch: async ({ providerCall }) => ({ dispatchAuthorized: true, providerOperationIdentity: { providerOperationId: providerCall.providerCallId, executionId: winningExecutionId, slotId: "semantic", task: "movie-mentor-semantic", providerTarget: { dispatchModel: "test-model" }, currentModelVerified: true, providerModel: "test-model" } }),
        contributeProviderEffectEvidence: async () => ({ authorized: true }),
        beginExecutionClosing: async () => fail("CLOSURE_CROSSED_TEST"),
        reconcileExecutionClosure: async () => fail("CLOSURE_RECONCILE_CROSSED_TEST"),
        stageResultCandidate: async () => fail("CANDIDATE_CROSSED_TEST"),
        readResultCandidate: async () => null,
        commitCanonicalResult: async () => fail("CANONICAL_CROSSED_TEST"),
        readCanonicalResult: async () => null,
      },
      interpretSemantics: async (_input, context) => {
        providerCalls += 1;
        assert.equal(context.providerOperation.executionId, winningExecutionId);
        return { semantic: true };
      },
      orchestrateTurn: async (_input, deps) => {
        orchestrationCalls += 1;
        await deps.interpretSemantics({ message: "Continue my movie." });
        const stop = new Error("PROVIDER_BINDING_PROVEN_STOP");
        stop.code = "PROVIDER_BINDING_PROVEN_STOP";
        throw stop;
      },
    },
  ),
  (error) => error?.code === "PROVIDER_BINDING_PROVEN_STOP",
);

assert.equal(findCalls, 3, "race must be discovered only after openExecution conflict");
assert.equal(reserveCalls, 1, "losing runtime must create exactly one fresh reservation");
assert.equal(openCalls, 1, "losing runtime must reach exactly one conflicting execution open");
assert.equal(releaseUnboundCalls, 1, "losing fresh reservation must be released exactly once");
assert.equal(readReservationCalls, 1, "winner reservation must be rehydrated exactly once");
assert.equal(acquireCalls, 1, "winning execution must be acquired exactly once");
assert.equal(orchestrationCalls, 1, "orchestration must resume only under winner authority");
assert.equal(claimCalls, 1, "provider claim must occur exactly once under winner authority");
assert.equal(providerCalls, 1, "provider work must occur exactly once under winner authority");
assert.equal(releaseUnclaimedCalls, 1, "the deliberate post-proof stop must clean up the acquired winner exactly once");

console.log("PASS: turn-conflict recovery releases the losing reservation and carries the winning execution plus its own live reservation into provider-call authority.");
