import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ci = await readFile(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");

const syntaxOwners = [
  "ai/MovieMentorRecoveredProviderResultAuthority.js",
  "ai/MovieMentorRecoveredSemanticResult.js",
  "ai/MovieMentorRecoveredStructuredResult.js",
  "ai/MovieMentorRecoveredTaskResult.js",
  "scripts/verify-movie-mentor-recovered-result-reconstruction-authority.mjs",
];

for (const owner of syntaxOwners) {
  assert.match(
    ci,
    new RegExp(`node --check ${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    `Backend CI must syntax-check recovered-result owner ${owner}`,
  );
}

assert.match(
  ci,
  /Verify Movie Mentor recovered-result reconstruction authority[\s\S]*node scripts\/verify-movie-mentor-recovered-result-reconstruction-authority\.mjs/,
  "Backend CI must execute the behavioral recovered-result reconstruction court",
);

console.log("Movie Mentor recovered-result Backend CI authority verifier passed.");
