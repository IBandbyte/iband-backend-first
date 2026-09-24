import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor compensated-release idempotent execution provenance reachability court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");

const start=settlement.indexOf("async function compensateSupersededCreatorState");
assert.ok(start>=0);
const compensation=settlement.slice(start);
const releasedStart=compensation.indexOf('if(text(reservation.status)==="released")');
const consumedStart=compensation.indexOf('if(text(reservation.status)==="consumed")',releasedStart);
assert.ok(releasedStart>=0&&consumedStart>releasedStart);
const released=compensation.slice(releasedStart,consumedStart);

assert.match(compensation,/executions\.updateOne\(\{executionId:id,phase:text\(execution\.phase\),reservationId:text\(reservation\.reservationId\),providerCallsClaimed:execution\.providerCallsClaimed\},\{\$set:\{phase:"compensated",compensatedAt:at,compensationReason:"superseded-creator-state"\}/,
  "production compensation must own the terminal execution transition");
assert.match(compensation,/reservations\.findOneAndUpdate\(\{reservationId:text\(reservation\.reservationId\),status:"reserved"\},\{\$set:\{status:"released",settledAt:at,settlementReason:reason,settlementExecutionId:id\}/,
  "the exact reservation disposition must be paired in the same compensation transaction");
assert.match(compensation,/session\.withTransaction/,"execution compensation and reservation release must be one transaction");

assert.match(released,/text\(reservation\.settlementReason\)!==reason/);
assert.match(released,/text\(reservation\.settlementExecutionId\)!==id/);

assert.match(execution,/if\(phase==="compensated"&&\(calls\.length<1\|\|v\.providerCallsClaimed!==calls\.length\|\|!iso\(v\.compensatedAt\)\|\|!text\(v\.compensationReason\)\|\|text\(v\.compensationReason\)!=="superseded-creator-state"\)\)fail/,
  "durable compensated execution normalization must preserve exact compensation identity");
assert.match(execution,/if\(current\.phase!=="active"\|\|text\(record\.phase\)!=="active"\)fail/,
  "generic replacement must not rewrite terminal compensated history");
assert.match(execution,/if\(!\["closing","closed","finalized","settled"\]\.includes\(current\.phase\)/,
  "quarantine authority must not adopt or rewrite compensated history");
assert.doesNotMatch(execution,/\$set:\{[^}]*phase:"compensated"/,
  "generic execution store must expose no independent compensated-state writer");
assert.match(runtime,/s\(existing\.phase\) === "compensated"/,
  "runtime must treat compensated Creator-turn history as terminal");

console.log("GREEN: authorized production code creates COMPENSATED execution + released compensation receipt atomically; generic execution authorities cannot subsequently rewrite that terminal phase.");
console.log("LAW: RELEASED CREATOR-COMPENSATION RECEIPTS MAY RECOGNIZE THEIR EXACT EXECUTION BINDING IDEMPOTENTLY WHEN THE PRODUCTION WRITE GRAPH MAKES COMPENSATED + RELEASED ONE ATOMIC TERMINAL DISPOSITION AND EXPOSES NO LATER COMPENSATED-STATE REWRITER.");
