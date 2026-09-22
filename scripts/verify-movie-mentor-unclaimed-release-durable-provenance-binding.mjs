import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unclaimed-release durable provenance binding court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function releaseUnclaimedReservation");
const end=source.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start,"unclaimed release implementation must exist");
const release=source.slice(start,end);

assert.match(release,/if\(text\(reservation\.status\)==="released"\)/,
  "active zero-claim execution has an already-released reservation path");
assert.match(release,/settlementReason:"execution-aborted-before-provider-claim"/,
  "fresh unclaimed release records its owned reason");

const releasedBranch=release.slice(
  release.indexOf('if(text(reservation.status)==="released")'),
  release.indexOf('if(text(reservation.status)!=="reserved")')
);
assert.ok(releasedBranch.length>0,"already-released branch must be isolatable");

assert.match(
  releasedBranch,
  /settlementReason/,
  "RED: adopting a pre-existing released reservation must inspect durable release provenance, not status alone"
);
assert.match(
  releasedBranch,
  /executionId|settlementExecutionId|releaseExecutionId/,
  "RED: adopted release provenance must bind the release to the exact execution"
);

console.log("GREEN: pre-existing released reservation is adopted only with exact durable release provenance.");
console.log("LAW: RELEASE STATUS ALONE IS NOT EXECUTION OWNERSHIP; ZERO-CLAIM ABORT MAY ADOPT A PRE-EXISTING RELEASE ONLY WHEN DURABLE PROVENANCE BINDS THAT RELEASE TO THE SAME EXECUTION.");
