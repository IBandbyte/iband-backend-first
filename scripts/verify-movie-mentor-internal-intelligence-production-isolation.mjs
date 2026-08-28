import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.2 — internal intelligence surface production isolation torture");

const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
const orchestrator = fs.readFileSync(new URL("../ai/MovieMentorTurnOrchestrator.js", import.meta.url), "utf8");

for (const basePath of [
  "/api/movie-mentor-semantic",
  "/api/movie-mentor-specialists",
  "/api/movie-mentor-synthesis",
]) {
  assert.equal(server.includes(basePath), false, `${basePath} must have zero production mount references`);
}

assert.match(server, /app\.use\("\/api\/movie-mentor", router\)/, "canonical creator gateway must remain mounted through explicit authority composition");
assert.match(server, /createMovieMentorProductionAuthenticationComposition/, "creator authentication composition must remain present");
assert.match(server, /createMovieMentorCreatorRequestAuthority/, "creator request authority must remain present");
assert.match(server, /assembleMovieMentorJourneyRecoveryProductionBoot/, "certified recovery assembly must remain present");

assert.match(orchestrator, /from "\.\/MovieMentorSemanticInterpreter\.js"/, "orchestrator must retain direct semantic capability");
assert.match(orchestrator, /from "\.\/MovieMentorSpecialistExecutor\.js"/, "orchestrator must retain direct specialist capability");
assert.match(orchestrator, /from "\.\/MovieMentorSynthesisEngine\.js"/, "orchestrator must retain direct synthesis capability");
assert.match(orchestrator, /await interpret\(semanticInput\)/, "semantic execution must remain inside canonical turn orchestration");
assert.match(orchestrator, /await executeSpecialists\(clone\(specialistPlan\)\)/, "specialist execution must remain inside canonical turn orchestration");
assert.match(orchestrator, /await synthesize\(/, "synthesis execution must remain inside canonical turn orchestration");

for (const adapter of ["movieMentorSemantic.js", "movieMentorSpecialists.js", "movieMentorSynthesis.js"]) {
  assert.equal(fs.existsSync(new URL(`../${adapter}`, import.meta.url)), true, `${adapter} may remain as an unmounted adapter/test fixture`);
}

console.log("✓ semantic standalone HTTP adapter has zero production exposure");
console.log("✓ specialist standalone HTTP adapter has zero production exposure");
console.log("✓ synthesis standalone HTTP adapter has zero production exposure");
console.log("✓ canonical authenticated creator gateway remains production-mounted");
console.log("✓ certified recovery assembly remains untouched");
console.log("✓ semantic, specialist and synthesis capabilities remain internal to canonical turn orchestration");
console.log("LAW: internal intelligence capability does not imply public route authority");
console.log("LAW: no canonical authenticated creator turn -> no public inference path");
console.log("5A.2 torture: GREEN");
