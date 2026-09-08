import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");

const requiredSyntaxOwners = [
  "ai/MovieMentorProviderTargetAuthority.js",
  "ai/MovieMentorProviderOperationAuthority.js",
  "ai/MovieMentorProviderOperationMongoStore.js",
  "ai/MovieMentorProviderOutcomeRecoveryAuthority.js",
  "ai/MovieMentorProviderRecoveryAdapter.js",
  "ai/MovieMentorProviderEffectAuthority.js",
  "ai/MovieMentorProviderEffectMongoStore.js",
  "ai/MovieMentorInferenceExecutionLeaseAuthority.js",
  "ai/MovieMentorInferenceExecutionMongoStore.js",
  "ai/MovieMentorProductionInferenceExecutionComposition.js",
  "scripts/verify-movie-mentor-provider-recovery-identity-authority.mjs",
  "scripts/verify-movie-mentor-provider-outcome-recovery-authority.mjs",
  "scripts/verify-movie-mentor-provider-outcome-recovery-lease-authority.mjs",
  "scripts/verify-movie-mentor-provider-recovery-operation-binding-authority.mjs",
];

for (const owner of requiredSyntaxOwners) {
  assert.match(
    workflow,
    new RegExp(`node --check ${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    `Backend CI must own syntax proof for ${owner}`,
  );
}

assert.match(
  workflow,
  /node scripts\/verify-movie-mentor-provider-recovery-identity-authority\.mjs/,
  "Backend CI must execute the provider recovery identity behavioral court",
);
assert.match(
  workflow,
  /node scripts\/verify-movie-mentor-provider-outcome-recovery-authority\.mjs/,
  "Backend CI must execute the provider outcome recovery behavioral court",
);
assert.match(
  workflow,
  /node scripts\/verify-movie-mentor-provider-outcome-recovery-lease-authority\.mjs/,
  "Backend CI must execute the provider outcome recovery current-lease behavioral court",
);
assert.match(
  workflow,
  /node scripts\/verify-movie-mentor-provider-recovery-operation-binding-authority\.mjs/,
  "Backend CI must execute the provider recovery operation-binding behavioral court",
);

console.log("✓ Backend CI owns syntax proof for provider recovery production modules and courts");
console.log("✓ Backend CI executes provider recovery identity, outcome, current-lease, and operation-binding behavioral courts");
console.log("LAW: BACKEND CI MAY NOT CERTIFY PRODUCTION CODE IT DOES NOT ACTUALLY INSPECT.");
console.log("Movie Mentor provider recovery Backend CI authority gate: GREEN");
