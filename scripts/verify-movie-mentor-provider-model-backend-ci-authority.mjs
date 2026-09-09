import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

console.log("Movie Mentor provider model Backend CI jurisdiction court");

const backendCi = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const verifier = "scripts/verify-movie-mentor-provider-model-authority.mjs";
const compositionVerifier = "scripts/verify-movie-mentor-provider-model-composition-authority.mjs";
const jurisdictionVerifier = "scripts/verify-movie-mentor-provider-model-backend-ci-authority.mjs";
const durableNullModelVerifier = "scripts/verify-movie-mentor-durable-null-model-authority.mjs";
const providerOperationSchemaVerifier = "scripts/verify-movie-mentor-provider-operation-current-execution-schema-authority.mjs";

for (const [path, label] of [
  [verifier, "provider model authority verifier"],
  [compositionVerifier, "provider model production-composition verifier"],
  [jurisdictionVerifier, "provider model jurisdiction verifier"],
]) {
  assert.match(backendCi, new RegExp(`node --check ${path.replaceAll(".", "\\.")}`), `Backend CI must syntax-own the ${label}`);
  assert.match(backendCi, new RegExp(`node ${path.replaceAll(".", "\\.")}`), `Backend CI must behaviorally execute the ${label}`);
}

for (const target of [durableNullModelVerifier, providerOperationSchemaVerifier]) {
  for (const args of [["--check", target], [target]]) {
    const result = spawnSync(process.execPath, args, {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `Backend CI provider-model jurisdiction must ${args[0] === "--check" ? "syntax-own" : "behaviorally execute"} ${target}.\n${result.stdout || ""}${result.stderr || ""}`,
    );
  }
}

console.log("✓ Backend CI's directly-owned provider-model jurisdiction syntax-checks and executes durable null-model authority");
console.log("✓ Backend CI's directly-owned provider-model jurisdiction syntax-checks and executes provider-operation current-schema production-reachability exoneration");
console.log("LAW: PROVIDER MODEL/OPERATION AUTHORITY MUST BE OWNED BY BACKEND CI, INCLUDING PRODUCTION COMPOSITION, DURABLE NULL-VERSUS-ABSENCE PROOF, AND CURRENT-SCHEMA REACHABILITY.");
console.log("Movie Mentor provider model Backend CI jurisdiction: GREEN");
