import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor provider model production-composition authority court");

const source = fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js", import.meta.url), "utf8");

assert.match(
  source,
  /function operationCapabilityProven\(status\)\{[^}]*status\?\.immutableProviderModel===true/,
  "production composition must refuse to certify a provider-operation store unless immutable provider-model capability is explicitly proven",
);
assert.match(
  source,
  /providerOperationModelImmutableBeforeUnknownRequired:fullExecutionAuthority===true/,
  "owned production composition status must declare provider-model immutability as a required authority property",
);

console.log("✓ production composition requires immutable provider-model capability before owning full inference authority");
console.log("✓ composition status exposes provider-model immutability as an owned requirement");
console.log("LAW: A STORE MAY IMPLEMENT MODEL IMMUTABILITY. PRODUCTION COMPOSITION MUST REQUIRE IT BEFORE CLAIMING AUTHORITY.");
console.log("Movie Mentor provider model production-composition authority: GREEN");

// Backend CI owns the live production-composition compatibility court directly.
await import("./verify-movie-mentor-canonical-lineage-composition-authority.mjs");
