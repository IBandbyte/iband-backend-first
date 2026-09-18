import assert from "node:assert/strict";
import { runMovieMentorTurn, digestCreatorResponsePayload } from "../ai/MovieMentorTurnRuntime.js";

const principalId = "creator-conflict-terminal";
const projectId = "project-conflict-terminal";
const creatorTurnId = "turn-conflict-terminal";
const losingReservationId = "reservation-loser-terminal";
const winningReservationId = "reservation-winner-terminal";
const winningExecutionId = "execution-winner-terminal";
const payload = Object.freeze({ success: true, text: "Durable concurrent winner." });
const resultDigest = digestCreatorResponsePayload(payload);

let findCalls = 0;
let reserveCalls = 0;
let openCalls = 0;
let releaseUnboundCalls = 0;
let reconcileCalls = 0;
let readCanonicalCalls = 0;
let readReservationCalls = 0;
let acquireCalls = 0;
let providerCalls = 0;

const winner = Object.freeze({
  found: true, authorized: true, phase: "settled", executionId: winningExecutionId,
  creatorTurnId, principalId, projectId, reservationId: winningReservationId,
  requestDigest: "winner-digest",
});

const canonical = Object.freeze({
  authorized: true, committed: true, currentRealityVerified: true,
  candidateLineageVerified: true, resultFinalizationVerified: true,
  executionPhase: "settled", providerEffectRealityRevision: 9,
  executionId: winningExecutionId, creatorTurnId, principalId, projectId,
  reservationId: winningReservationId, requestDigest: winner.requestDigest,
  resultReference: "result-winner-terminal", candidateReference: "candidate-winner-terminal",
  closureReference: "closure-winner-terminal", closureCertificateDigest: "closure-digest-winner-terminal",
  resultDigest, resultPayload: payload,
});

const settlement = Object.freeze({
  authorized: true, settled: true, outcome: "consumed", resultFinalizationVerified: true,
  executionPhase: "settled", providerEffectRealityRevision: 9,
  executionId: winningExecutionId, principalId, projectId, reservationId: winningReservationId,
  resultReference: canonical.resultReference, candidateReference: canonical.candidateReference,
  resultDigest, closureCertificateDigest: canonical.closureCertificateDigest,
});

const fail = message => { throw new Error(message); };

const result = await runMovieMentorTurn(
  { projectId, creatorTurnId, message: "Continue my movie." },
  {
    serverAuthority: { authenticated: true, projectAuthorized: true, principalId, projectId },
    readAuthoritativeTurnSource: async () => ({
      projectId, creatorSessionId: "session-conflict-terminal", revision: 1,
      revisionAuthorityReference: "revision-1", creatorStateGeneration: 1,
      creatorStateFingerprint: "fingerprint-1", creatorAuthorityReference: "creator-authority-1",
      snapshotReference: "snapshot-1", capturedAt: "2026-09-18T00:00:00.000Z", creatorConfirmedContext: [],
    }),
    readAuthoritativeRevision: async () => ({ authorized: true, revision: 1 }),
    readAuthoritativeCreatorState: async () => ({ authorized: true }),
    inferenceSpendAuthority: {
      reserveTurn: async () => {
        reserveCalls += 1;
        return { authorized: true, status: "reserved", reservationId: losingReservationId, principalId, projectId, creatorTurnId };
      },
      readReservation: async () => { readReservationCalls += 1; return fail("TERMINAL_WINNER_MUST_NOT_REHYDRATE_SPEND"); },
    },
    inferenceSettlementAuthority: {
      reconcile: async ({ executionId }) => {
        reconcileCalls += 1;
        assert.equal(executionId, winningExecutionId);
        return settlement;
      },
      releaseUnbound: async ({ reservationId }) => {
        releaseUnboundCalls += 1;
        assert.equal(reservationId, losingReservationId, "only losing fresh reservation may be released");
        return { authorized: true, released: true, outcome: "released", reservationId, principalId, projectId };
      },
      releaseUnclaimed: async () => fail("TERMINAL_WINNER_MUST_NOT_RELEASE_UNCLAIMED"),
    },
    inferenceExecutionAuthority: {
      findExecutionByCreatorTurn: async () => {
        findCalls += 1;
        return findCalls <= 2 ? { found: false, authorized: false } : winner;
      },
      openExecution: async () => {
        openCalls += 1;
        const error = new Error("concurrent winner");
        error.code = "MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";
        throw error;
      },
      readCanonicalResult: async ({ executionId }) => {
        readCanonicalCalls += 1;
        assert.equal(executionId, winningExecutionId);
        return canonical;
      },
      acquireExecution: async () => { acquireCalls += 1; return fail("TERMINAL_WINNER_MUST_NOT_BE_ACQUIRED"); },
      assertFence: async () => fail("TERMINAL_WINNER_MUST_NOT_CROSS_FENCE"),
      claimProviderCall: async () => { providerCalls += 1; return fail("TERMINAL_WINNER_MUST_NOT_CROSS_PROVIDER"); },
      beginProviderDispatch: async () => fail("TERMINAL_WINNER_MUST_NOT_DISPATCH"),
      assertProviderDispatch: async () => fail("TERMINAL_WINNER_MUST_NOT_DISPATCH"),
      contributeProviderEffectEvidence: async () => fail("TERMINAL_WINNER_MUST_NOT_CONTRIBUTE_EFFECT"),
      stageResultCandidate: async () => fail("TERMINAL_WINNER_MUST_NOT_STAGE"),
      readResultCandidate: async () => null,
      beginExecutionClosing: async () => fail("TERMINAL_WINNER_MUST_NOT_CLOSE"),
      reconcileExecutionClosure: async () => fail("TERMINAL_WINNER_MUST_NOT_RECONCILE_CLOSURE"),
      commitCanonicalResult: async () => fail("TERMINAL_WINNER_MUST_NOT_COMMIT"),
    },
    orchestrateTurn: async () => { providerCalls += 1; return fail("TERMINAL_WINNER_MUST_NOT_ORCHESTRATE"); },
  },
);

assert.deepEqual(result, payload, "runtime must return the concurrent terminal winner's exact durable canonical payload");
assert.equal(findCalls, 3, "winner must appear only after the execution-open conflict");
assert.equal(reserveCalls, 1);
assert.equal(openCalls, 1);
assert.equal(releaseUnboundCalls, 1, "losing fresh reservation must be released exactly once");
assert.equal(readCanonicalCalls, 1, "terminal winner canonical result must be read exactly once");
assert.equal(reconcileCalls, 1, "terminal winner settlement must be reconciled exactly once");
assert.equal(readReservationCalls, 0, "terminal winner must not rehydrate spend");
assert.equal(acquireCalls, 0, "terminal winner must not reacquire execution");
assert.equal(providerCalls, 0, "terminal winner replay must perform zero provider/orchestration work");

console.log("PASS: turn-conflict recovery releases the losing fresh reservation and returns the terminal winner's exact durable settled result with zero new provider work.");
