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

assert.match(release,/predispatchClaimAbandoned=true/,"production must expose the #329 predispatch claimed-abandonment path");
assert.match(release,/providerCallsClaimed:claimed,providerEffectRealityRevision:realityRevision/,"predispatch abandonment must bind the admitted claim universe and provider-reality revision");
assert.match(release,/abortReason:"predispatch-claim-abandoned"/,"predispatch abandonment currently writes a durable terminal identity");

assert.match(executionStore,/if\(phase==="aborted"&&\(calls\.length!==0\|\|v\.providerCallsClaimed!==0\|\|!iso\(v\.abortedAt\)\|\|!text\(v\.abortReason\)\)\)fail\("MOVIE_MENTOR_INFERENCE_EXECUTION_ABORT_RECORD_INVALID"/,
  "canonical execution rehydration rejects aborted records carrying any provider claim");

const writerCanEmitClaimedAbort=/if\(predispatchClaimAbandoned\)\{barrier=await executions\.updateOne\(\{executionId:id,phase:"active",reservationId:text\(reservation\.reservationId\),providerCallsClaimed:claimed,providerEffectRealityRevision:realityRevision\},\{\$set:\{phase:"aborted",abortedAt,abortReason:"predispatch-claim-abandoned"\}/.test(release);
const canonicalReaderAcceptsClaimedAbort=!/if\(phase==="aborted"&&\(calls\.length!==0\|\|v\.providerCallsClaimed!==0/.test(executionStore);
assert.equal(writerCanEmitClaimedAbort,true,"court setup requires the reachable #329 claimed-abort writer");
assert.equal(canonicalReaderAcceptsClaimedAbort,true,
  "a terminal record emitted by the authorized predispatch abandonment writer must be readable by the canonical execution store on same-turn retry/rehydration");

assert.doesNotMatch(runtime,/Creator turn was durably aborted before any provider claim/,
  "runtime terminal semantics must not falsely describe a claimed-before-dispatch abandonment as a zero-claim abort");

console.log("GREEN: predispatch claimed abandonment has one canonical durable terminal identity that survives authoritative rehydration.");
console.log("LAW: AN AUTHORIZED TERMINAL WRITER MAY NOT COMMIT A DURABLE EXECUTION RECORD THAT THE CANONICAL EXECUTION READER REJECTS OR MISDESCRIBES ON RETRY.");
