import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.41 — quarantine ↔ provider-reality serialization authority court");

const execution = fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js", import.meta.url), "utf8");
const effects = fs.readFileSync(new URL("../ai/MovieMentorProviderEffectMongoStore.js", import.meta.url), "utf8");

const start = execution.indexOf("async function quarantineExecution");
const end = execution.indexOf("return Object.freeze({readExecution", start);
assert.ok(start >= 0 && end > start, "quarantine writer must be present");
const quarantine = execution.slice(start, end);

assert.match(effects, /executionLedger\(\)\.updateOne\(\{executionId:current\.executionId\},\{\$inc:\{providerEffectRealityRevision:1\}\}/,
  "late provider evidence must mutate execution provider-reality revision");
assert.ok(quarantine.includes("providerEffectRealityRevision"),
  "quarantine must CAS the provider-reality revision it inspected so quarantine cannot cross a concurrent late-reality contribution");
assert.ok(quarantine.includes("resultFinalizationBarrierRevision"),
  "quarantine from finalized/settled history must CAS the finalization barrier it inspected");

console.log("LAW: QUARANTINE MUST BE ONE SERIALIZED DECISION WITH THE PROVIDER-REALITY AND FINALIZATION UNIVERSE IT REVOKES.");
