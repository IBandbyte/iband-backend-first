import assert from "node:assert/strict";

// AUD-OPEN-01 verifier-only design constraint.
// An earlier reversal ID can commit at any later instant.
// No finite fixed-ID overlap or finite number of one-off replays can
// guarantee discovery of an arbitrarily late commit without a future trigger.
function forwardPage(committed, after, limit) {
  return committed.filter(id => after === null || id > after).sort().slice(0, limit);
}
for (const limit of [1, 2, 50]) {
  const late = "0-early-id";
  const committed = Array.from({length: limit + 1}, (_, i) => "1-later-id-" + String(i).padStart(3, "0"));
  const cursor = committed[0];
  assert.equal(forwardPage(committed, cursor, limit).includes(late), false);
  committed.push(late); // Commit after the cursor was issued.
  assert.equal(forwardPage(committed, cursor, limit).includes(late), false,
    "Forward-only cursor cannot discover a lower ID committed later");
  assert.equal(forwardPage(committed, null, limit).includes(late), true,
    "Fresh full replay discovers a now-committed earlier ID");
}
// Even a successful replay at t=1 does not prove completeness at t=2.
// A late transaction may commit at t=3, after any finite replay schedule.
const finiteReplayTimes = [1, 2];
const lateCommitTime = 3;
assert.ok(finiteReplayTimes.every(t => t < lateCommitTime));
assert.equal(finiteReplayTimes.some(t => t >= lateCommitTime), false);
console.log("DESIGN CONSTRAINT GREEN (MODEL ONLY): fixed forward cursors and finite replays cannot guarantee arbitrary late-commit liveness; a durable future wake-up or commit-order authority is required. Physical Mongo reds remain authoritative.");
