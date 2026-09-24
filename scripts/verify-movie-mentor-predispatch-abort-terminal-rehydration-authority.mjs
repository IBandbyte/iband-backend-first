import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor predispatch-abort terminal rehydration authority court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const executionStore=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");

const releaseStart=settlement.indexOf("async function releaseUnclaimedReservation");
const releaseEnd=settlement.indexOf("async function releaseUnboundReservation",releaseStart);
assert.ok(releaseStart>=0&&releaseEnd>releaseStart);
const release=settlement.slice(releaseStart,releaseEnd);

assert.match(release,/predispatchProviderCallId=null/,"release authority must receive exact recovered provider-call identity");
assert.match(release,/claimedCall=calls\.find\(call=>text\(call\?\.providerCallId\)===exactCallId\)/,
  "refund proof must bind the exact admitted provider call");
assert.match(release,/OPERATION_COLLECTION\)\.find\(\{executionId:id\}/,
  "terminal release must re-prove absence of durable provider operation reality inside settlement transaction");
assert.match(release,/effects\.find\(\{executionId:id\}/,
  "terminal release must re-prove absence of provider effect reality inside settlement transaction");
assert.match(release,/providerCallsClaimed:0,providerCalls:\[\],abandonedPredispatchProviderCalls:calls/,
  "claimed-before-dispatch history must be archived while canonical terminal claim authority returns to zero");
assert.match(release,/abortReason:"predispatch-claim-abandoned"/);

assert.match(executionStore,/abandonedPredispatchProviderCalls:\{type:\[callSchema\],default:\[\]\}/,
  "execution schema must durably preserve abandoned predispatch admission history");
assert.match(executionStore,/if\(phase==="aborted"&&\(calls\.length!==0\|\|v\.providerCallsClaimed!==0/,
  "historical terminal law must remain: aborted execution has zero live provider claims");
assert.match(runtime,/predispatchProviderCallId: error\?\.refundAuthorized === true \? s\(error\?\.providerCallId\) : null/,
  "runtime must carry the exact recovered historical claim into release authority");
assert.doesNotMatch(runtime,/Creator turn was durably aborted before any provider claim/,
  "runtime must not misdescribe admitted-before-dispatch history as no provider claim");

const claimedAbortWriter=/\$set:\{phase:"aborted",abortedAt,abortReason:"predispatch-claim-abandoned"\}(?![^}]*providerCallsClaimed:0)/.test(release);
assert.equal(claimedAbortWriter,false,
  "authorized predispatch abandonment must never commit an aborted terminal with live provider claims");

console.log("GREEN: claimed-before-dispatch abandonment is exact-claim bound, re-proves no operation/effect reality, archives admission history, and commits canonical zero-live-claim terminal state.");
console.log("LAW: AN AUTHORIZED TERMINAL WRITER MAY NOT COMMIT A DURABLE EXECUTION RECORD THAT THE CANONICAL EXECUTION READER REJECTS OR MISDESCRIBES ON RETRY; HISTORICAL ADMISSION MAY BE PRESERVED WITHOUT RETAINING LIVE CLAIM AUTHORITY.");
