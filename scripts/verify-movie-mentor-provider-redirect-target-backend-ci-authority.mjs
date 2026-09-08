import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider redirect-target Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-redirect-target-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-redirect-target-backend-ci-authority.mjs";

assert.match(backendCi, new RegExp(`node --check ${verifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own the provider redirect-target verifier");
assert.match(backendCi, new RegExp(`node ${verifier.replaceAll(".", "\\.")}`), "Backend CI must behaviorally execute the provider redirect-target verifier");
assert.match(backendCi, new RegExp(`node --check ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own its provider redirect-target jurisdiction verifier");
assert.match(backendCi, new RegExp(`node ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must execute its provider redirect-target jurisdiction verifier");

console.log("LAW: PROVIDER REDIRECT-TARGET AUTHORITY MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor provider redirect-target Backend CI jurisdiction: GREEN");
