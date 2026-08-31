import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryActivationLeaseAuthority } from "../ai/MovieMentorJourneyRecoveryActivationLeaseAuthority.js";
import { createMovieMentorJourneyRecoveryLiveFenceEnforcement } from "../ai/MovieMentorJourneyRecoveryLiveFenceEnforcement.js";
import { authorizeMovieMentorJourneyRecoveryProcessActivation } from "../ai/MovieMentorJourneyRecoveryCrossProcessActivationBoundary.js";
import {
  createMovieMentorJourneyRecoveryActivationLeaseMongoStore,
  inspectMovieMentorJourneyRecoveryActivationLease,
  MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_DOMAIN,
  MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_SCHEMA,
  MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_SERVICE_KEY,
} from "../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js";

console.log("4G.4 Round Seven — journey recovery proof-time absence torture");

const BASE = Object.freeze({
  authorized: true,
  processInstanceId: "process-a",
  deploymentId: "deployment-a",
  basePath: "/api/movie-mentor-recovery",
  expectedIssuer: "https://issuer.example",
  expectedAudience: "movie-mentor-recovery",
  activationEpoch: "7",
  activationReference: "activation-7",
  leaseReference: "lease-7",
  fencingToken: "fence-7-secret",
  leaseGeneration: 7,
  status: "active",
  acquiredAt: "2030-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:01:00.000Z",
  authorizationSource: "durable-test-authority",
});

const binding = Object.freeze({
  processInstanceId: BASE.processInstanceId,
  deploymentId: BASE.deploymentId,
  basePath: BASE.basePath,
  expectedIssuer: BASE.expectedIssuer,
  expectedAudience: BASE.expectedAudience,
});

let storeTouches = 0;
const absentClockAuthority = createMovieMentorJourneyRecoveryActivationLeaseAuthority({
  readLease: async () => { storeTouches += 1; return null; },
  createLease: async () => { storeTouches += 1; throw new Error("must not write without proof time"); },
  replaceLease: async () => { storeTouches += 1; throw new Error("must not replace without proof time"); },
  now: () => null,
});
await assert.rejects(
  () => absentClockAuthority.authorizeActivation(binding),
  (error) => error?.code === "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_TIME_INVALID"
);
assert.equal(storeTouches, 0, "absent authority clock must fail before durable lease access or mutation");

const absentDurableExpiryAuthority = createMovieMentorJourneyRecoveryActivationLeaseAuthority({
  readLease: async () => ({ ...BASE, expiresAt: null }),
  createLease: async () => { throw new Error("must not create over malformed durable lease"); },
  replaceLease: async () => { throw new Error("must not replace malformed durable lease"); },
  now: () => new Date("2030-01-01T00:00:30.000Z"),
});
await assert.rejects(
  () => absentDurableExpiryAuthority.authorizeActivation(binding),
  (error) => error?.code === "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_TIME_INVALID"
);

assert.throws(
  () => createMovieMentorJourneyRecoveryLiveFenceEnforcement({
    activationEvidence: { ...BASE, expiresAt: null },
    renewActivation: async () => BASE,
    assertFence: async () => BASE,
  }),
  (error) => error?.code === "MOVIE_MENTOR_RECOVERY_LIVE_FENCE_EVIDENCE_REQUIRED"
);

let timerEscaped = false;
const absentLiveClock = createMovieMentorJourneyRecoveryLiveFenceEnforcement({
  activationEvidence: BASE,
  now: () => null,
  setTimer: () => { timerEscaped = true; throw new Error("absent clock must not schedule renewal"); },
  renewActivation: async () => BASE,
  assertFence: async () => BASE,
});
absentLiveClock.start();
assert.equal(timerEscaped, false);
assert.equal(absentLiveClock.getStatus().authorized, false);
assert.equal(absentLiveClock.getStatus().reason, "activation-lease-clock-invalid");

const absentBoundaryExpiry = await authorizeMovieMentorJourneyRecoveryProcessActivation({
  ...binding,
  authorizeActivation: async () => ({ ...BASE, expiresAt: null }),
});
assert.equal(absentBoundaryExpiry.authorized, false);
assert.equal(absentBoundaryExpiry.reason, "cross-process-activation-evidence-incomplete");

const durableShape = {
  domain: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_DOMAIN,
  schema: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_MONGO_STORE_SCHEMA,
  serviceKey: MOVIE_MENTOR_JOURNEY_RECOVERY_ACTIVATION_LEASE_SERVICE_KEY,
  ...BASE,
};
const absentAcquiredAt = inspectMovieMentorJourneyRecoveryActivationLease({ ...durableShape, acquiredAt: null });
assert.equal(absentAcquiredAt.valid, false);
assert.equal(absentAcquiredAt.reason, "time-invalid");
const absentExpiresAt = inspectMovieMentorJourneyRecoveryActivationLease({ ...durableShape, expiresAt: null });
assert.equal(absentExpiresAt.valid, false);
assert.equal(absentExpiresAt.reason, "time-invalid");

let mongoWrites = 0;
const mongoStore = createMovieMentorJourneyRecoveryActivationLeaseMongoStore({
  mongoModel: {
    async create() { mongoWrites += 1; throw new Error("must not write malformed candidate"); },
  },
});
await assert.rejects(
  () => mongoStore.createLease({ ...BASE, leaseGeneration: 1, activationEpoch: "1", acquiredAt: null }),
  (error) => error?.code === "MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RECORD_INVALID" && error?.reason === "time-invalid"
);
assert.equal(mongoWrites, 0, "absent durable timestamp must fail before Mongo mutation");

console.log("✓ null authority clock cannot become Unix epoch or touch durable lease state");
console.log("✓ null durable expiry cannot become historical active-lease authority");
console.log("✓ null live-fence expiry cannot become complete authorized evidence");
console.log("✓ null live evaluation clock closes the mounted recovery fence before scheduling renewal");
console.log("✓ null cross-process expiry cannot cross the activation boundary");
console.log("✓ null acquired/expiry timestamps fail durable Mongo schema inspection and candidate writes before mutation");
console.log("LAW: ABSENCE IS NOT 1970. NO PROOF TIME → NO LEASE AUTHORITY → NO LIVE RECOVERY EXPOSURE.");
console.log("4G.4 Round Seven proof-time absence torture: GREEN");
