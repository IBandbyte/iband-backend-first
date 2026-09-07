import assert from "node:assert/strict";
import fs from "node:fs";

const ci = fs.readFileSync(new URL("../.github/workflows/ci-backend.yml", import.meta.url), "utf8");

assert.match(
  ci,
  /node --check scripts\/verify-movie-mentor-continuity-historical-input-authority\.mjs/,
  "Backend CI must syntax-check the Continuity historical-input behavioral court",
);
assert.match(
  ci,
  /Verify Movie Mentor Continuity historical-input authority[\s\S]*node scripts\/verify-movie-mentor-continuity-historical-input-authority\.mjs/,
  "Backend CI must execute the Continuity historical-input behavioral court",
);
assert.match(
  ci,
  /node --check ai\/MovieMentorProviderOperationMongoStore\.js/,
  "Backend CI must syntax-own the durable provider operation store that carries historical input",
);
assert.match(
  ci,
  /node --check ai\/MovieMentorRecoveredTaskResult\.js/,
  "Backend CI must syntax-own the local recovered Continuity reconstruction court",
);

console.log("Movie Mentor Continuity historical-input Backend CI authority verifier passed.");
