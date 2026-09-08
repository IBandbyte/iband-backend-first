import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider null-model runtime Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-null-model-runtime-propagation.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-null-model-runtime-backend-ci-authority.mjs";

for (const [path, label] of [
  [verifier, "provider null-model runtime propagation verifier"],
  [jurisdictionVerifier, "provider null-model runtime Backend CI jurisdiction verifier"],
]) {
  assert.match(
    backendCi,
    new RegExp(`node --check ${path.replaceAll(".", "\\.")}`),
    `Backend CI must syntax-own the ${label}`,
  );
  assert.match(
    backendCi,
    new RegExp(`node ${path.replaceAll(".", "\\.")}`),
    `Backend CI must behaviorally execute the ${label}`,
  );
}

console.log("LAW: EXPLICIT NULL PROVIDER-MODEL AUTHORITY MUST BE OWNED BY BACKEND CI THROUGH THE LIVE RUNTIME-TO-SOCKET HANDOFF.");
console.log("Movie Mentor provider null-model runtime Backend CI jurisdiction: GREEN");
