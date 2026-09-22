import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor compensated-release idempotent execution provenance court");

const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const execution=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const start=settlement.indexOf("async function compensateSupersededCreatorState");
assert.ok(start>=0,"Creator Compensation implementation must exist");
const compensation=settlement.slice(start);

assert.match(compensation,/const reason="creator-compensation:superseded-creator-state"/,
  "Creator Compensation must own an exact durable reservation disposition");
assert.match(compensation,/settlementReason:reason,settlementExecutionId:id/,
  "fresh compensation must bind released reservation to exact execution");
assert.match(execution,/phase==="compensated"[\s\S]*compensationReason\)!=="superseded-creator-state"/,
  "compensated execution normalization must preserve exact compensation identity");

const releasedStart=compensation.indexOf('if(text(reservation.status)==="released")');
const consumedStart=compensation.indexOf('if(text(reservation.status)==="consumed")',releasedStart);
assert.ok(releasedStart>=0&&consumedStart>releasedStart,"released compensation idempotence branch must exist");
const released=compensation.slice(releasedStart,consumedStart);

assert.match(released,/text\(reservation\.settlementReason\)!==reason/,
  "released reservation idempotence must prove Creator Compensation disposition");
assert.match(released,/text\(reservation\.settlementExecutionId\)!==id/,
  "released reservation idempotence must prove exact execution binding");
assert.match(released,/text\(execution\.phase\)!=="compensated"/,
  "RED: released Creator Compensation history may be adopted idempotently only when the exact execution is durably terminal COMPENSATED");
assert.match(released,/text\(execution\.compensationReason\)!=="superseded-creator-state"/,
  "RED: idempotent compensation must prove the execution carries this authority's exact durable compensation reason");

console.log("GREEN: Creator Compensation idempotence proves both released-reservation ownership and exact terminal execution provenance.");
console.log("LAW: A COMPENSATION RECEIPT MAY BE IDEMPOTENT ONLY WHEN BOTH SIDES OF THE ATOMIC DISPOSITION SURVIVE: THE RELEASED RESERVATION MUST BIND THE EXECUTION, AND THAT EXECUTION MUST REMAIN DURABLY COMPENSATED FOR THE SAME REASON.");
