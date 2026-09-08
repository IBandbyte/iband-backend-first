import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

console.log("Movie Mentor provider null-model runtime Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-null-model-runtime-propagation.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-null-model-runtime-backend-ci-authority.mjs";
const socketMarkerVerifier = "scripts/verify-movie-mentor-socket-model-marker-authority.mjs";

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

for (const args of [
  ["--check", socketMarkerVerifier],
  [socketMarkerVerifier],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `Backend CI null-model runtime jurisdiction must ${args[0] === "--check" ? "syntax-own" : "behaviorally execute"} the socket model-marker authority court.\n${result.stdout || ""}${result.stderr || ""}`,
  );
}

console.log("✓ Backend CI's directly-owned null-model runtime jurisdiction syntax-checks the socket model-marker court");
console.log("✓ Backend CI's directly-owned null-model runtime jurisdiction behaviorally executes the socket model-marker court");
console.log("LAW: EXPLICIT NULL PROVIDER-MODEL AUTHORITY MUST BE OWNED BY BACKEND CI THROUGH THE LIVE RUNTIME-TO-SOCKET HANDOFF, INCLUDING THE SOCKET'S EXPLICIT MARKER PROOF.");
console.log("Movie Mentor provider null-model runtime Backend CI jurisdiction: GREEN");
