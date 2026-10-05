import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor ordinary refund absent preserved-credit authority court");

const ingress = fs.readFileSync(new URL("../ai/MovieMentorCommercialProviderIngressAuthority.js", import.meta.url), "utf8");
const disposition = fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js", import.meta.url), "utf8");

assert.match(ingress, /commercialReversal===true/, "commercial reversal path must exist");
assert.match(ingress, /terminallySettlePreservedValue/, "reversal path must reach terminal preserved-value settlement");

const start = disposition.indexOf("async function terminallySettlePreservedValue");
const end = disposition.indexOf("const s=status(true)");
assert.ok(start >= 0 && end > start, "terminal disposition owner must exist");
const terminal = disposition.slice(start, end);

assert.match(terminal, /findOne\(q\)/, "terminal owner must look up exact provider-payment disposition");
const explicitAbsentOutcome = /if\s*\(\s*!row\s*\)/.test(terminal) && /status:"not-preserved"/.test(terminal);

assert.equal(
  explicitAbsentOutcome,
  true,
  "RED: an ordinary successfully-issued payment has no preserved-credit row, but verified provider reversal reaches terminal settlement without an explicit absent-row outcome."
);

console.log("GREEN: provider reversal safely distinguishes payments for which no preserved credit exists.");
console.log("LAW: ORDINARY REFUNDS MUST NOT FAIL MERELY BECAUSE SUSPENSION CREDIT WAS NEVER CREATED.");
