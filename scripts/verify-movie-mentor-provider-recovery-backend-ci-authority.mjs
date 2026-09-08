import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");
const jurisdiction = "scripts/verify-movie-mentor-provider-recovery-backend-ci-authority.mjs";

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
  jurisdiction,
];

for (const owner of requiredSyntaxOwners) {
  assert.match(
    workflow,
    new RegExp(`node --check ${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    `Backend CI must own syntax proof for ${owner}`,
  );
}

for (const court of [
  "scripts/verify-movie-mentor-provider-recovery-identity-authority.mjs",
  "scripts/verify-movie-mentor-provider-outcome-recovery-authority.mjs",
  "scripts/verify-movie-mentor-provider-outcome-recovery-lease-authority.mjs",
  "scripts/verify-movie-mentor-provider-recovery-operation-binding-authority.mjs",
  jurisdiction,
]) {
  assert.match(
    workflow,
    new RegExp(`node ${court.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    `Backend CI must behaviorally execute ${court}`,
  );
}

console.log("✓ Backend CI owns syntax proof for provider recovery production modules, courts, and jurisdiction verifier");
console.log("✓ Backend CI executes provider recovery identity, outcome, current-lease, operation-binding, and jurisdiction courts");
console.log("LAW: BACKEND CI MAY NOT CERTIFY PRODUCTION CODE OR PROOF IT DOES NOT ACTUALLY OWN.");
console.log("Movie Mentor provider recovery Backend CI authority gate: GREEN");
