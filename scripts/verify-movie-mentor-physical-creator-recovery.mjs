import assert from "node:assert/strict";
import { runMovieMentorPhysicalCreatorRecoveryCourt } from "./movie-mentor-physical-creator-recovery-court.mjs";

// Physical court must use actual signed RS256 JWT, loopback HTTP and isolated
// Mongo ownership/state collections. No injected ownership or read doubles.
// The runner must prove valid owner success, foreign/unsigned denial,
// invalid state denial, and zero state/ownership mutations by GET.
const evidence = await runMovieMentorPhysicalCreatorRecoveryCourt();
assert.equal(evidence?.realRs256, true, "RED: real RS256 signature verification required");
assert.equal(evidence?.loopbackHttp, true, "RED: actual HTTP ingress required");
assert.equal(evidence?.isolatedMongo, true, "RED: isolated Mongo required");
assert.equal(evidence?.durableOwnerAllowed, true, "RED: durable owner must recover");
assert.equal(evidence?.foreignOwnerDenied, true, "RED: foreign owner must be denied");
assert.equal(evidence?.forgedJwtDenied, true, "RED: forged JWT must be denied");
assert.equal(evidence?.readOnlyLedger, true, "RED: GET must not mutate ownership or creator state");
console.log("GREEN PHYSICAL CREATOR RECOVERY: signed RS256, loopback HTTP, durable Mongo ownership and read-only state proven");
