import assert from "node:assert/strict";
import fs from "node:fs";
console.log("5A.40 — result-candidate ↔ abort/release serialization authority court");
const candidate=fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js",import.meta.url),"utf8");
const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
assert.match(candidate,/\$inc:\{resultCandidateBarrierRevision:1\}/,"candidate staging must mutate execution candidate barrier");
const release=settlement.slice(settlement.indexOf("async function releaseUnclaimedReservation"),settlement.indexOf("async function releaseUnboundReservation"));
assert.match(release,/resultCandidateBarrierRevision/,"ACTIVE→ABORTED release must serialize against candidate staging so a valid durable candidate cannot be created concurrently with reservation release");
console.log("LAW: RESULT-CANDIDATE STAGING AND ACTIVE→ABORTED RELEASE MUST SHARE ONE PHYSICAL SERIALIZATION BARRIER; RELEASE MAY NOT WIN WHILE CANDIDATE DURABILITY IS IN FLIGHT.");
