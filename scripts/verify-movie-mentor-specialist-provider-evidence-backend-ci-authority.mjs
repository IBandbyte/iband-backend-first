import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor post-provider evidence Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-specialist-provider-evidence-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-specialist-provider-evidence-backend-ci-authority.mjs";

assert.match(
  backendCi,
  new RegExp(`node --check ${verifier.replaceAll(".", "\\.")}`),
  "Backend CI must syntax-own the post-provider domain-rejection evidence verifier",
);
assert.match(
  backendCi,
  new RegExp(`node ${verifier.replaceAll(".", "\\.")}`),
  "Backend CI must behaviorally execute the post-provider domain-rejection evidence verifier",
);
assert.match(
  backendCi,
  new RegExp(`node --check ${jurisdictionVerifier.replaceAll(".", "\\.")}`),
  "Backend CI must syntax-own its jurisdiction verifier",
);
assert.match(
  backendCi,
  new RegExp(`node ${jurisdictionVerifier.replaceAll(".", "\\.")}`),
  "Backend CI must execute its jurisdiction verifier rather than relying on dedicated-workflow green",
);

console.log("✓ Backend CI syntax-owns the post-provider evidence court");
console.log("✓ Backend CI behaviorally executes the post-provider evidence court");
console.log("✓ Backend CI owns the jurisdiction proof itself");
console.log("LAW: A DEDICATED GREEN CANNOT SUBSTITUTE FOR BACKEND CI JURISDICTION.");
console.log("Movie Mentor post-provider evidence Backend CI jurisdiction: GREEN");
