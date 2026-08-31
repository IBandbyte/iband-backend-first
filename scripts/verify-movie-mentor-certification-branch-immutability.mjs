import assert from "node:assert/strict";
import fs from "node:fs";

const currentLiveIsolationWorkflows = [
  ".github/workflows/verify-movie-mentor-semantic-live-isolation.yml",
  ".github/workflows/verify-movie-mentor-specialists-live.yml",
  ".github/workflows/verify-movie-mentor-synthesis-live.yml",
];

for (const path of currentLiveIsolationWorkflows) {
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source, /permissions:\s*\n\s*contents:\s*read/, `${path} must be repository-read-only`);
  assert.doesNotMatch(source, /contents:\s*write/, `${path} must not own repository write capability`);
  assert.doesNotMatch(source, /git\s+push\b/, `${path} must not push verification evidence into repository history`);
  assert.doesNotMatch(source, /git\s+commit\b/, `${path} must not commit verification evidence into repository history`);
  assert.doesNotMatch(source, /git\s+pull\s+--rebase\b/, `${path} must not rewrite itself against a moving certification branch`);
  assert.doesNotMatch(source, /Commit verification report/, `${path} must not contain a branch-mutating report step`);
}

for (const path of [
  ".github/workflows/verify-movie-mentor-specialists-live.yml",
  ".github/workflows/verify-movie-mentor-synthesis-live.yml",
]) {
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source, /IBAND_LIVE_REPORT_PATH:/, `${path} must still produce live verification evidence in the runner workspace`);
  assert.match(source, /continue-on-error:\s*true/, `${path} must still allow the report to be written before enforcement`);
  assert.match(source, /Enforce live isolation result/, `${path} must retain explicit live-result enforcement`);
  assert.match(source, /process\.exit\(1\)/, `${path} must still fail when live proof fails`);
}

assert.equal(fs.existsSync(new URL("../.github/workflows/verify-movie-mentor-live.yml", import.meta.url)), false, "obsolete public semantic live-path workflow must stay retired");
assert.equal(fs.existsSync(new URL("../scripts/verify-movie-mentor-live.mjs", import.meta.url)), false, "obsolete public semantic live-path verifier must stay retired");

const semanticIsolation = fs.readFileSync(new URL("../.github/workflows/verify-movie-mentor-semantic-live-isolation.yml", import.meta.url), "utf8");
assert.match(semanticIsolation, /Verify standalone semantic route is not public/, "semantic live proof must remain an isolation proof");
assert.match(semanticIsolation, /verify-movie-mentor-semantic-live-isolation\.mjs/, "semantic live isolation owner gate must remain wired");

console.log("PASS ROUND SEVEN: live verification cannot write to main, and the obsolete public semantic-path arrow is retired.");
console.log("LAW: A TEST MAY RECORD EVIDENCE. IT MAY NOT SILENTLY MOVE THE CERTIFICATION FLOOR.");
console.log("LAW: NO PHASE GETS CREDIT FOR A PROOF IT DOESN'T OWN. SEMANTIC ISOLATION OWNS SEMANTIC LIVE PROOF.");
