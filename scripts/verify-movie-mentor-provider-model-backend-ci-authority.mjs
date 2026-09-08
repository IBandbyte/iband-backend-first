import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

console.log("Movie Mentor provider model Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-model-authority.mjs";
const compositionVerifier = "scripts/verify-movie-mentor-provider-model-composition-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-model-backend-ci-authority.mjs";
const durableNullModelVerifier = "scripts/verify-movie-mentor-durable-null-model-authority.mjs";

for (const [path, label] of [
  [verifier, "provider model authority verifier"],
  [compositionVerifier, "provider model production-composition verifier"],
  [jurisdictionVerifier, "provider model jurisdiction verifier"],
]) {
  assert.match(backendCi, new RegExp(`node --check ${path.replaceAll(".", "\\.")}`), `Backend CI must syntax-own the ${label}`);
  assert.match(backendCi, new RegExp(`node ${path.replaceAll(".", "\\.")}`), `Backend CI must behaviorally execute the ${label}`);
}

for (const args of [
  ["--check", durableNullModelVerifier],
  [durableNullModelVerifier],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `Backend CI provider-model jurisdiction must ${args[0] === "--check" ? "syntax-own" : "behaviorally execute"} the durable null-model authority court.\n${result.stdout || ""}${result.stderr || ""}`,
  );
}

console.log("✓ Backend CI's directly-owned provider-model jurisdiction syntax-checks the durable null-model court");
console.log("✓ Backend CI's directly-owned provider-model jurisdiction behaviorally executes the durable null-model court");
console.log("LAW: PROVIDER MODEL AUTHORITY MUST BE OWNED BY BACKEND CI, INCLUDING PRODUCTION COMPOSITION AND DURABLE NULL-VERSUS-ABSENCE PROOF.");
console.log("Movie Mentor provider model Backend CI jurisdiction: GREEN");
