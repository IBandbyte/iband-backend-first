import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider capability Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-capability-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-capability-backend-ci-authority.mjs";
const escaped = (value) => value.replaceAll(".", "\\.");

assert.match(
  backendCi,
  new RegExp(`node --check ${escaped(verifier)}`),
  "Backend CI must syntax-own the provider capability authority court",
);
assert.match(
  backendCi,
  new RegExp(`node ${escaped(verifier)}`),
  "Backend CI must behaviorally execute the provider capability authority court",
);
assert.match(
  backendCi,
  new RegExp(`node --check ${escaped(jurisdictionVerifier)}`),
  "Backend CI must syntax-own the provider capability jurisdiction court",
);
assert.match(
  backendCi,
  new RegExp(`node ${escaped(jurisdictionVerifier)}`),
  "Backend CI must execute the provider capability jurisdiction court",
);

console.log("LAW: PROVIDER CAPABILITY AUTHORITY MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor provider capability Backend CI jurisdiction: GREEN");
