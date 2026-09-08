import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor recovered response effect-binding Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-recovered-response-effect-binding-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-recovered-response-effect-binding-backend-ci-authority.mjs";

assert.match(backendCi, new RegExp(`node --check ${verifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own the recovered response effect-binding verifier");
assert.match(backendCi, new RegExp(`node ${verifier.replaceAll(".", "\\.")}`), "Backend CI must behaviorally execute the recovered response effect-binding verifier");
assert.match(backendCi, new RegExp(`node --check ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must syntax-own its recovered response effect-binding jurisdiction verifier");
assert.match(backendCi, new RegExp(`node ${jurisdictionVerifier.replaceAll(".", "\\.")}`), "Backend CI must execute its recovered response effect-binding jurisdiction verifier");

console.log("LAW: RECOVERED RESPONSE EFFECT BINDING MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor recovered response effect-binding Backend CI jurisdiction: GREEN");
