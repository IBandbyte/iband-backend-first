import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor recovered lease-binding Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const bridge = fs.readFileSync(new URL("./verify-movie-mentor-recovered-provider-model-backend-ci-authority.mjs", import.meta.url), "utf8");
const bridgeVerifier = "scripts/verify-movie-mentor-recovered-provider-model-backend-ci-authority.mjs";
const leaseVerifier = "./verify-movie-mentor-recovered-lease-binding-authority.mjs";
const leaseJurisdiction = "./verify-movie-mentor-recovered-lease-binding-backend-ci-authority.mjs";

assert.match(backendCi, new RegExp(`node ${bridgeVerifier.replaceAll(".", "\\.")}`), "Backend CI must execute the jurisdiction bridge that owns recovered lease binding");
assert.match(bridge, new RegExp(`import [\"']${leaseVerifier.replaceAll(".", "\\.")}[\"']`), "Backend CI jurisdiction bridge must behaviorally execute the recovered lease-binding verifier");
assert.match(bridge, new RegExp(`import [\"']${leaseJurisdiction.replaceAll(".", "\\.")}[\"']`), "Backend CI jurisdiction bridge must execute the recovered lease-binding jurisdiction court");

console.log("LAW: RECOVERED LEASE-BINDING AUTHORITY MUST BE OWNED BY BACKEND CI, NOT BORROWED FROM A DEDICATED GREEN.");
console.log("Movie Mentor recovered lease-binding Backend CI jurisdiction: GREEN");
