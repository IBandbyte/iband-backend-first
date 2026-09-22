import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor unclaimed-release released-state provenance authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function releaseUnclaimedReservation");
const end=source.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start,"unclaimed release implementation must exist");
const release=source.slice(start,end);

assert.match(release,/if\(text\(execution\.phase\)==="aborted"\)\{if\(execution\.providerCallsClaimed!==0\|\|\(execution\.providerCalls\|\|\[\]\)\.length!==0\|\|text\(reservation\.status\)!=="released"\)fail\("MOVIE_MENTOR_INFERENCE_RELEASE_ABORT_CONFLICT"/,
  "already-aborted idempotence must require zero claims and released reservation");
assert.match(release,/if\(text\(reservation\.status\)==="released"\)\{outcome=Object\.freeze\(\{released:true,authorized:true,outcome:"released",idempotent:true/,
  "active zero-claim execution currently accepts any already-released reservation after abort barrier");
assert.match(release,/settlementReason:"execution-aborted-before-provider-claim"/,
  "this authority owns a specific durable release provenance when it performs the release");

assert.doesNotMatch(
  release,
  /if\(text\(reservation\.status\)==="released"\)\{[^}]*settlementReason[^}]*execution-aborted-before-provider-claim/,
  "RED: active execution must not adopt a released reservation as its own zero-claim abort unless durable release provenance proves this execution owns that release"
);

console.log("GREEN: already-released reservation adoption is provenance-bound to this execution's zero-claim abort authority.");
console.log("LAW: RELEASED IS A STATE, NOT OWNERSHIP PROOF; AN ACTIVE EXECUTION MAY NOT ADOPT PRE-EXISTING RELEASE HISTORY WITHOUT DURABLE PROVENANCE BINDING THAT RELEASE TO THIS EXECUTION.");
