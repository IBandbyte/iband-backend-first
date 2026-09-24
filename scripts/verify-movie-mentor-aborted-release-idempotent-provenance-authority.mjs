import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor aborted-release idempotent provenance reachability court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const lease=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionLeaseAuthority.js",import.meta.url),"utf8");
const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");

const start=settlement.indexOf("async function releaseUnclaimedReservation");
const end=settlement.indexOf("async function releaseUnboundReservation",start);
assert.ok(start>=0&&end>start);
const release=settlement.slice(start,end);
const abortedStart=release.indexOf('if(text(execution.phase)==="aborted")');
const activeStart=release.indexOf('if(text(execution.phase)!=="active")',abortedStart);
const aborted=release.slice(abortedStart,activeStart);
assert.ok(abortedStart>=0&&activeStart>abortedStart);

assert.match(release,/executions\.updateOne\(\{executionId:id,phase:"active",reservationId:text\(reservation\.reservationId\),providerCallsClaimed:0,"providerCalls\.0":\{\$exists:false\},resultCandidateBarrierRevision:candidateBarrierRevision\},\{\$set:\{phase:"aborted",abortedAt,abortReason:"unclaimed-reservation-released"\}/,
  "the production abort transition must be owned by the atomic unclaimed-release transaction");
assert.match(release,/reservations\.findOneAndUpdate\(\{reservationId:text\(reservation\.reservationId\),status:"reserved"\},\{\$set:\{status:"released",settledAt:abortedAt,settlementReason:"execution-aborted-before-provider-claim"\}/,
  "the paired reservation release must be written in that same transaction");
assert.match(release,/session\.withTransaction/,"abort and release must share one transaction");

assert.match(execution,/if\(phase==="aborted"&&\(calls\.length!==0\|\|v\.providerCallsClaimed!==0\|\|!iso\(v\.abortedAt\)\|\|!text\(v\.abortReason\)\)\)fail/,
  "durable aborted records must retain zero-claim abort identity");
assert.doesNotMatch(execution,/\$set:\{[^}]*phase:"aborted"/,
  "generic execution store must not expose an independent aborted-state writer");
assert.match(lease,/phase === "aborted"/,"lease authority must treat aborted history as terminal");
assert.match(runtime,/s\(existing\.phase\) === "aborted"/,"runtime must terminate a retried aborted turn");

assert.match(aborted,/providerCallsClaimed!==0/);
assert.match(aborted,/text\(reservation\.status\)!=="released"/);
assert.doesNotMatch(aborted,/settlementReason/,
  "state-only idempotence is safe only because authorized production transitions create aborted+released as one atomic pair");

console.log("GREEN: authorized production code has one atomic zero-claim abort+release writer; generic execution authority cannot independently mint aborted history, and retry treats it as terminal.");
console.log("LAW: TERMINAL ABORTED + RELEASED HISTORY MAY BE IDEMPOTENTLY RECOGNIZED BY STATE WHEN THE PRODUCTION WRITE GRAPH MAKES THAT PAIR ATOMICALLY OWNED AND NO INDEPENDENT ABORT WRITER EXISTS.");
