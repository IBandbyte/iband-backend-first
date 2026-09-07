import assert from "node:assert/strict";
import fs from "node:fs";

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const dedicated = fs.readFileSync(new URL("../.github/workflows/verify-movie-mentor-live-execution-lease-enforcement.yml", import.meta.url), "utf8");

console.log("Movie Mentor Live Execution Lease Backend CI jurisdiction court");

assert.match(
  dedicated,
  /pull_request:\s*[\s\S]*branches:\s*\[main\][\s\S]*scripts\/verify-movie-mentor-live-execution-lease-enforcement\.mjs/,
  "the Live Lease owning workflow must speak on relevant pull requests before merge",
);
assert.match(
  dedicated,
  /\.github\/workflows\/ci-backend\.yml/,
  "changes to Backend CI jurisdiction must retrigger the Live Lease owner",
);
assert.match(
  dedicated,
  /scripts\/verify-movie-mentor-live-lease-backend-ci-authority\.mjs/,
  "the Live Lease owner must watch its Backend CI jurisdiction proof",
);
assert.match(
  dedicated,
  /Verify Live Lease Backend CI jurisdiction[\s\S]*node scripts\/verify-movie-mentor-live-lease-backend-ci-authority\.mjs/,
  "the dedicated Live Lease court must execute its jurisdiction verifier",
);

assert.match(
  backendCi,
  /node --check scripts\/verify-movie-mentor-live-execution-lease-enforcement\.mjs/,
  "Backend CI must syntax-check the Live Lease behavioral verifier",
);
assert.match(
  backendCi,
  /node --check scripts\/verify-movie-mentor-live-lease-backend-ci-authority\.mjs/,
  "Backend CI must syntax-check the Live Lease jurisdiction verifier",
);
assert.match(
  backendCi,
  /Verify Movie Mentor live execution lease enforcement[\s\S]*node scripts\/verify-movie-mentor-live-execution-lease-enforcement\.mjs/,
  "Backend CI must behaviorally execute the Live Lease court",
);
assert.match(
  backendCi,
  /Verify Movie Mentor Live Lease Backend CI authority[\s\S]*node scripts\/verify-movie-mentor-live-lease-backend-ci-authority\.mjs/,
  "Backend CI must execute the independent jurisdiction proof",
);

console.log("PASS — Live Lease owns PR proof and Backend CI independently owns the same behavioral court.");
