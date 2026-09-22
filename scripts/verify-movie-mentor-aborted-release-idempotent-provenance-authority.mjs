import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor aborted-release idempotent provenance authority court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const start=settlement.indexOf("async function releaseUnclaimedReservation");
const end=settlement.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start,"unclaimed release implementation must exist");
const release=settlement.slice(start,end);

const abortedStart=release.indexOf('if(text(execution.phase)==="aborted")');
const activeStart=release.indexOf('if(text(execution.phase)!=="active")',abortedStart);
assert.ok(abortedStart>=0&&activeStart>abortedStart,"aborted idempotence branch must precede active release");
const aborted=release.slice(abortedStart,activeStart);

assert.match(execution,/if\(phase==="aborted"&&\(calls\.length!==0\|\|v\.providerCallsClaimed!==0\|\|!iso\(v\.abortedAt\)\|\|!text\(v\.abortReason\)\)\)fail/,
  "durable execution normalization must require zero claims, abort time and abort reason");
assert.match(release,/abortReason:"unclaimed-reservation-released"/,
  "fresh unclaimed release must record its owned abort provenance");
assert.match(release,/settlementReason:"execution-aborted-before-provider-claim"/,
  "fresh unclaimed release must record its owned reservation provenance");

assert.match(aborted,/text\(execution\.abortReason\)==="unclaimed-reservation-released"/,
  "RED: an already-aborted execution may claim idempotent release only when its durable abort provenance belongs to this authority");
assert.match(aborted,/text\(reservation\.settlementReason\)==="execution-aborted-before-provider-claim"/,
  "RED: an already-aborted execution may claim idempotent release only when the reservation carries this authority's matching durable release provenance");

console.log("GREEN: aborted idempotence proves both sides of the zero-claim release provenance pair.");
console.log("LAW: ABORTED + RELEASED ARE STATES, NOT OWNERSHIP; IDEMPOTENT ZERO-CLAIM RELEASE MUST PROVE THE DURABLE ABORT/RELEASE PROVENANCE PAIR OWNED BY THIS AUTHORITY.");
