import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor preserved-credit terminal disposition authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialValueDispositionComposition.js",import.meta.url),"utf8");

assert.match(source,/movie_mentor_commercial_value_disposition/,"production preserved-value collection must exist");
assert.match(source,/preserveVerifiedPaidValue/,"production must durably preserve provider-confirmed paid value denied by suspension");
assert.match(source,/status:\{type:String,enum:\[[^\]]*"preserved-credit"[^\]]*\]/,"preserved paid value must enter the durable preserved-credit state");

const hasTerminalDispositionOwner =
 /terminallySettlePreservedValue/.test(source) &&
 /"released-credit"/.test(source) &&
 /"refunded"/.test(source) &&
 /"charged-back"/.test(source) &&
 /"terminated"/.test(source) &&
 /status:"preserved-credit"/.test(source) &&
 /terminalReference/.test(source);

assert.equal(
 hasTerminalDispositionOwner,
 true,
 "RED: provider-confirmed paid value can be durably preserved as preserved-credit, but production exposes no terminal disposition owner that can later release, refund, charge back, terminate, or otherwise terminally settle that preserved value."
);

console.log("GREEN: preserved credit has a production-owned terminal disposition path.");
console.log("LAW: DURABLE PRESERVATION IS NOT TERMINAL OWNERSHIP; PROVIDER-CONFIRMED CUSTOMER VALUE MUST HAVE AN OWNED, AUDITABLE, EXACTLY-ONCE FUTURE DISPOSITION.");
