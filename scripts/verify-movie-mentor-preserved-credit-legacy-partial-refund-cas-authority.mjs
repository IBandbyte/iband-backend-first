import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor preserved-credit legacy partial-refund CAS authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");
assert.match(source,/cumulativeRefundedAmountMinor:Number\.isSafeInteger\(v\.cumulativeRefundedAmountMinor\)\?v\.cumulativeRefundedAmountMinor:0/,"court requires backward-compatible normalization of missing cumulative refund state to zero");
const cas=source.match(/findOneAndUpdate\(\{\.\.\.q,status:"preserved-credit",cumulativeRefundedAmountMinor:[^}]+\}/)?.[0]||"";
assert.ok(cas,"court requires the partial-refund cumulative CAS boundary");
assert.equal(/row\.cumulativeRefundedAmountMinor\?\?0/.test(cas),false,"RED: legacy rows normalize missing cumulative refund state to zero, but the physical CAS requires equality to numeric zero; a missing Mongo field cannot match that predicate and retry can repeat indefinitely.");
assert.match(cas,/\$exists|\$or|cumulativeRefundedAmountMinor:\{\$in:/,"RED: first partial refund must physically match both legacy missing state and explicit zero state.");
console.log("GREEN: first partial refund CAS accepts both legacy missing cumulative-refund state and explicit zero.");
console.log("LAW: BACKWARD-COMPATIBLE NORMALIZATION MUST BE MATCHED BY BACKWARD-COMPATIBLE PHYSICAL CAS AUTHORITY; LOGICAL ZERO MAY NOT STRAND A LEGACY MISSING FIELD.");
