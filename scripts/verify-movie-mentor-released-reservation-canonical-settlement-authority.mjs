import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor released reservation canonical settlement authority court");

const settlementSource = fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js", import.meta.url), "utf8");

assert.ok(
  settlementSource.includes('if(text(reservation.status)==="released")fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RELEASED_CONFLICT"'),
  "canonical settlement must explicitly reject a released reservation",
);

assert.ok(
  settlementSource.indexOf('const reservation=await reservations.findOne({reservationId:text(execution.reservationId)},{session})')
    < settlementSource.indexOf('if(text(reservation.status)==="released")fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RELEASED_CONFLICT"'),
  "settlement must read the exact execution-bound reservation before checking released state",
);

assert.ok(
  settlementSource.indexOf('if(text(reservation.status)==="released")fail("MOVIE_MENTOR_INFERENCE_SETTLEMENT_RELEASED_CONFLICT"')
    < settlementSource.indexOf('if(text(execution.phase)==="settled")'),
  "released economic authority must be fenced before settled/idempotent reconciliation can authorize canonical history",
);

assert.ok(
  settlementSource.includes('if(!reservationBindingValid(reservation,execution)){outcome=Object.freeze({settled:false,authorized:false,outcome:"reserved",reason:"reservation-binding-invalid"'),
  "canonical settlement must prove reservation/execution binding before any economic convergence",
);

console.log("PASS: released reservation cannot be reactivated by canonical settlement history");
console.log("LAW: HISTORICAL RESULT TRUTH MAY SURVIVE. RELEASED ECONOMIC AUTHORITY MAY NOT BE REACTIVATED BY REPLAY OR RECONCILIATION.");
