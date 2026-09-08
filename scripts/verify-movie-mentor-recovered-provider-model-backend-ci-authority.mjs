import assert from "node:assert/strict";
import fs from "node:fs";
import "./verify-movie-mentor-recovered-lease-binding-authority.mjs";
import "./verify-movie-mentor-recovered-lease-binding-backend-ci-authority.mjs";

console.log("Movie Mentor recovered provider model Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-recovered-provider-model-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-recovered-provider-model-backend-ci-authority.mjs";

assert.match(backendCi, new RegExp(`node --check ${verifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own the recovered provider model verifier");
assert.match(backendCi, new RegExp(`node ${verifier.replaceAll(".", "\\.")}`), "Backend CI must behaviorally execute the recovered provider model verifier");
assert.match(backendCi, new RegExp(`node --check ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own its recovered provider model jurisdiction verifier");
assert.match(backendCi, new RegExp(`node ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must execute its recovered provider model jurisdiction verifier");

console.log("LAW: RECOVERED PROVIDER MODEL AUTHORITY MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor recovered provider model Backend CI jurisdiction: GREEN");
