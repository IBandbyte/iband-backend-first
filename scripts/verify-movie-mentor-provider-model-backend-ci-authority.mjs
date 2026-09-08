import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider model Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-model-authority.mjs";
const compositionVerifier = "scripts/verify-movie-mentor-provider-model-composition-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-model-backend-ci-authority.mjs";

for (const [path, label] of [
  [verifier, "provider model authority verifier"],
  [compositionVerifier, "provider model production-composition verifier"],
  [jurisdictionVerifier, "provider model jurisdiction verifier"],
]) {
  assert.match(backendCi, new RegExp(`node --check ${path.replaceAll(".", "\\.")}`), `Backend CI must syntax-own the ${label}`);
  assert.match(backendCi, new RegExp(`node ${path.replaceAll(".", "\\.")}`), `Backend CI must behaviorally execute the ${label}`);
}

console.log("LAW: PROVIDER MODEL AUTHORITY MUST BE OWNED BY BACKEND CI, INCLUDING ITS PRODUCTION-COMPOSITION PROOF.");
console.log("Movie Mentor provider model Backend CI jurisdiction: GREEN");
