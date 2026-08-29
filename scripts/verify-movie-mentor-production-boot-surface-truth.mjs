import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.3 — production boot surface truth torture");

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");

assert.equal(server.includes("function mountRoute"), false, "generic best-effort route loader must not remain in production boot");
assert.equal(server.includes("mountRoute("), false, "production boot must not contain generic route mounts");

for (const forbidden of [
  "/api/ai-mentor",
  "/api/mentor",
  "/api/generate",
  "/api/studio",
  "./aiMentor.js",
  "./mentor.js",
  "./generate.js",
  "./studio.js",
  "/api/movie-mentor-semantic",
  "/api/movie-mentor-specialists",
  "/api/movie-mentor-synthesis",
]) {
  assert.equal(server.includes(forbidden), false, `${forbidden} must not exist in production boot`);
}

assert.match(server, /app\.get\("\/"/, "root route must remain present");
assert.match(server, /app\.get\("\/health"/, "health route must remain present");
assert.match(server, /createMovieMentorProductionAuthenticationComposition/, "creator authentication composition must remain present");
assert.match(server, /createMovieMentorCreatorRequestAuthority/, "creator request authority must remain present");
assert.match(server, /app\.use\("\/api\/movie-mentor", router\)/, "canonical authenticated Movie Mentor gateway must remain explicitly mounted");
assert.match(server, /assembleMovieMentorJourneyRecoveryProductionBoot/, "certified recovery assembly must remain present");
assert.match(server, /app\.listen\(/, "production boot must still reach the server listener");

console.log("✓ generic best-effort route loader removed");
console.log("✓ four dead legacy mount declarations removed");
console.log("✓ 5A.2 internal intelligence isolation remains intact");
console.log("✓ canonical authenticated Movie Mentor gateway remains explicit");
console.log("✓ certified recovery assembly remains intact");
console.log("✓ root, health and listener remain present");
console.log("LAW: production boot may expose only real, intentional capabilities");
console.log("LAW: a missing module is not a degraded route and must not survive as fictional production surface");
console.log("5A.3 torture: GREEN");
