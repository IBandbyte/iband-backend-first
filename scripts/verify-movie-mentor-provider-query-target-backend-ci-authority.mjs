import assert from "node:assert/strict";
import fs from "node:fs";

const backendCi = fs.readFileSync(".github/workflows/ci-backend.yml", "utf8");
const court = "scripts/verify-movie-mentor-provider-query-target-authority.mjs";
const jurisdiction = "scripts/verify-movie-mentor-provider-query-target-backend-ci-authority.mjs";

assert.ok(
  backendCi.includes(`node --check ${court}`),
  "Backend CI must syntax-own the provider query-target authority court",
);
assert.ok(
  backendCi.includes(`node ${court}`),
  "Backend CI must behaviorally execute the provider query-target authority court",
);
assert.ok(
  backendCi.includes(`node --check ${jurisdiction}`),
  "Backend CI must syntax-own the provider query-target jurisdiction verifier",
);
assert.ok(
  backendCi.includes(`node ${jurisdiction}`),
  "Backend CI must behaviorally execute the provider query-target jurisdiction verifier",
);

console.log("✓ Backend CI syntax-owns and executes provider query-target authority plus its jurisdiction proof");
console.log("LAW: PROVIDER QUERY-TARGET AUTHORITY MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor provider query-target Backend CI authority gate: GREEN");
