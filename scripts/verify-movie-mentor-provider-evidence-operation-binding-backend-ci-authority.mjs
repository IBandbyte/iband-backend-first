import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider evidence operation-binding Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-evidence-operation-binding-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-evidence-operation-binding-backend-ci-authority.mjs";

assert.match(backendCi, new RegExp(`node --check ${verifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own the provider evidence operation-binding verifier");
assert.match(backendCi, new RegExp(`node ${verifier.replaceAll(".", "\\.")}`), "Backend CI must behaviorally execute the provider evidence operation-binding verifier");
assert.match(backendCi, new RegExp(`node --check ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own its provider evidence operation-binding jurisdiction verifier");
assert.match(backendCi, new RegExp(`node ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must execute its provider evidence operation-binding jurisdiction verifier");

console.log("LAW: PROVIDER-EVIDENCE OPERATION BINDING MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor provider evidence operation-binding Backend CI jurisdiction: GREEN");
