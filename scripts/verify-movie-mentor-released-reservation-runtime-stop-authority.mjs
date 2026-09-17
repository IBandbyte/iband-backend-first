import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const RELEASED = "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_SETTLED";
const projectId = "project-released-runtime-stop";
const principalId = "creator-released-runtime-stop";
const creatorTurnId = "turn-released-runtime-stop";

const durable = {
  projectId,
  creatorSessionId: "session-released-runtime-stop",
  revision: 3,
  revisionAuthorityReference: "revision:released-runtime-stop:3",
  creatorStateGeneration: 2,
  creatorStateFingerprint: "b".repeat(64),
  creatorAuthorityReference: "creator-state:released-runtime-stop:g2",
  snapshotReference: "snapshot:released-runtime-stop:r3:g2",
  capturedAt: "2037-01-01T00:00:00.000Z",
  creatorConfirmedContext: [],
  projectJourney: null,
  memoryContext: null,
  responseBlueprint: null,
  communicationPlan: null,
};

let reserveCalls = 0;
let openExecutionCalls = 0;
let providerWorkCalls = 0;
let orchestrationCalls = 0;
let releaseUnboundCalls = 0;

const releasedError = Object.assign(
  new Error("Released reservation history cannot become fresh spend authority."),
  { code: RELEASED, retryable: false },
);

const inferenceSpendAuthority = {
  reserveTurn: async ({ serverAuthority, projectId: requestedProjectId, creatorTurnId: requestedCreatorTurnId }) => {
    reserveCalls += 1;
    assert.equal(serverAuthority?.principalId, principalId);
    assert.equal(requestedProjectId, projectId);
    assert.equal(requestedCreatorTurnId, creatorTurnId);
    throw releasedError;
  },
  readReservation: async () => {
    throw new Error("fresh released-reservation retry must not rehydrate an execution reservation");
  },
};

const forbiddenProvider = async () => {
  providerWorkCalls += 1;
  throw new Error("released reservation rejection must stop before provider authority");
};

const inferenceExecutionAuthority = {
  findExecutionByCreatorTurn: async () => ({ found: false, authorized: false }),
  openExecution: async () => {
    openExecutionCalls += 1;
    throw new Error("released reservation rejection must stop before openExecution");
  },
  acquireExecution: forbiddenProvider,
  assertFence: forbiddenProvider,
  claimProviderCall: forbiddenProvider,
  beginProviderDispatch: forbiddenProvider,
  assertProviderDispatch: forbiddenProvider,
  contributeProviderEffectEvidence: forbiddenProvider,
  beginExecutionClosing: forbiddenProvider,
  reconcileExecutionClosure: forbiddenProvider,
  stageResultCandidate: forbiddenProvider,
  readResultCandidate: forbiddenProvider,
  commitCanonicalResult: forbiddenProvider,
  readCanonicalResult: forbiddenProvider,
};

const inferenceSettlementAuthority = {
  reconcile: forbiddenProvider,
  releaseUnclaimed: forbiddenProvider,
  releaseUnbound: async () => {
    releaseUnboundCalls += 1;
    throw new Error("no fresh reservation was returned, so runtime must not release one");
  },
};

await assert.rejects(
  () => runMovieMentorTurn(
    {
      projectId,
      creatorSessionId: durable.creatorSessionId,
      creatorTurnId,
      message: "Retry the same creator turn after its deterministic reservation was released.",
    },
    {
      serverAuthority: {
        authenticated: true,
        projectAuthorized: true,
        principalId,
        projectId,
      },
      inferenceSpendAuthority,
      inferenceExecutionAuthority,
      inferenceSettlementAuthority,
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
        throw new Error("released reservation rejection must stop before orchestration");
      },
    },
  ),
  (error) => error === releasedError && error?.code === RELEASED && error?.retryable === false,
  "runtime must propagate the exact released-reservation authority rejection without opening execution",
);

assert.equal(reserveCalls, 1, "runtime must reach exactly one spend reservation decision");
assert.equal(openExecutionCalls, 0, "released reservation rejection must stop before openExecution");
assert.equal(providerWorkCalls, 0, "released reservation rejection must stop before all provider/execution authority work");
assert.equal(orchestrationCalls, 0, "released reservation rejection must stop before creator orchestration/provider work");
assert.equal(releaseUnboundCalls, 0, "runtime must not release a reservation object that was never returned");

console.log("GREEN: released same-turn reservation rejection stops the real turn runtime before execution or provider work.");
console.log("LAW: REJECTED HISTORICAL SPEND AUTHORITY MAY NOT CROSS THE EXECUTION BOUNDARY.");
