import assert from "node:assert/strict";
import { createForwardExecutionRuntimeDeps } from "../ai/MovieMentorForwardExecutionRuntime.js";

const binding = Object.freeze({
  creatorTurnId: "turn-provider-dispatch-spend",
  principalId: "creator-1",
  projectId: "project-1",
  reservationId: "reservation-1",
  requestDigest: "digest-1",
  ownerId: "owner-1",
});

let spendCurrent = true;
let spendReads = 0;

const inferenceSpendAuthority = Object.freeze({
  async readReservation({ reservationId, principalId, projectId } = {}) {
    spendReads += 1;
    assert.equal(reservationId, binding.reservationId);
    assert.equal(principalId, binding.principalId);
    assert.equal(projectId, binding.projectId);
    if (!spendCurrent) {
      const error = new Error("Reserved spend lost current entitlement authority before irreversible provider dispatch.");
      error.code = "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED";
      throw error;
    }
    return Object.freeze({
      authorized: true,
      reservationId,
      principalId,
      projectId,
      status: "reserved",
      units: 1,
      entitlementRevision: 17,
    });
  },
});

const forwardExecutionAuthority = Object.freeze({
  domain: "iband.movie-mentor.forward-execution-authority",
  schema: 1,
  principalId: binding.principalId,
  projectId: binding.projectId,
  async assertCurrentReacquisition() { throw new Error("reacquisition is outside this court"); },
  async assertCurrentProviderCallAdmission(target = {}) {
    return Object.freeze({
      domain: "iband.movie-mentor.forward-execution-proof",
      schema: 1,
      authorized: true,
      currentOwnershipVerified: true,
      ownershipRef: "ownership:project-1",
      ownershipRevision: 7,
      transition: "provider-call-admission",
      ...target,
    });
  },
});

const execution = Object.freeze({
  authorized: true,
  executionAuthorized: true,
  schema: 6,
  phase: "active",
  executionId: "execution-1",
  ...binding,
  leaseGeneration: 1,
  leaseReference: "lease-1",
  fencingToken: "fence-1",
  leaseExpiresAt: "2035-01-01T00:01:00.000Z",
  maxProviderCalls: 5,
  providerCallsClaimed: 0,
});

const baseExecutionAuthority = Object.freeze({
  async findExecutionByCreatorTurn() { return Object.freeze({ found: false, authorized: false }); },
  async acquireExecution() { throw new Error("reacquisition is outside this court"); },
  async claimProviderCall(input = {}) {
    const candidate = Object.freeze({
      ...execution,
      providerCallId: "provider-call-1",
      slotId: input.slotId,
      task: input.task,
      admittedAt: "2035-01-01T00:00:01.000Z",
    });
    await input.assertCurrentProviderCallAdmissionAuthority(candidate);
    return Object.freeze({ authorized: true, dispatchAuthorized: true, ...candidate });
  },
  async assertProviderDispatch({ providerCall } = {}) {
    return Object.freeze({
      authorized: true,
      dispatchAuthorized: true,
      providerCallId: providerCall?.providerCallId,
    });
  },
});

const guarded = createForwardExecutionRuntimeDeps({
  inferenceExecutionAuthority: baseExecutionAuthority,
  inferenceSpendAuthority,
  forwardExecutionAuthority,
}).inferenceExecutionAuthority;

const providerCall = await guarded.claimProviderCall({
  execution,
  slotId: "semantic",
  task: "movie-mentor-semantic",
});
assert.equal(providerCall.dispatchAuthorized, true);
assert.equal(spendReads, 1, "provider-call admission must consume current spend proof");

spendCurrent = false;
await assert.rejects(
  () => guarded.assertProviderDispatch({ providerCall }),
  error => error?.code === "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED",
  "irreversible provider dispatch must independently re-enter the exact reserved spend row under current entitlement reality",
);
assert.equal(spendReads, 2, "provider dispatch must own a new current-spend proof rather than borrow provider-call admission history");

console.log("GREEN: irreversible provider dispatch independently revalidates the exact reserved spend row under current entitlement reality.");
console.log("LAW: PROVIDER-CALL ADMISSION DOES NOT LEND ITS SPEND PROOF TO IRREVERSIBLE PROVIDER DISPATCH.");
