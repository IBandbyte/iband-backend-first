import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.30 — canonical candidate provenance authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
const match=source.match(/function candidateBindingMatches\(candidate,result\)\{([^}]*)\}/);
assert.ok(match,"canonical finalization must own an explicit candidate-binding court");
const court=match[1];
for(const field of [
  "stagedFromLeaseGeneration","stagedFromLeaseReference","stagedFromFencingToken",
  "creatorStateRevision","creatorStateGeneration","creatorStateFingerprint",
  "creatorStateOwnershipRef","creatorStateOwnershipRevision","stagedAt",
]){
  assert.ok(court.includes(field),`canonical finalization must reject a schema-2 candidate stripped of ${field}`);
}
assert.match(court,/stagedFromLeaseGeneration[^;]*execution|execution[^;]*stagedFromLeaseGeneration/,"canonical finalization must bind candidate lease generation to the execution that won staging authority");
assert.match(court,/stagedFromLeaseReference[^;]*execution|execution[^;]*stagedFromLeaseReference/,"canonical finalization must bind candidate lease reference to the execution that won staging authority");
assert.match(court,/stagedFromFencingToken[^;]*execution|execution[^;]*stagedFromFencingToken/,"canonical finalization must bind candidate fencing token to the execution that won staging authority");

console.log("✓ canonical finalization owns every proof-bearing schema-2 candidate provenance field");
console.log("✓ canonical finalization binds live-staging lease/fence provenance to the exact execution");
console.log("LAW: A CURRENT CANDIDATE SCHEMA LABEL CANNOT SUBSTITUTE FOR THE PROVENANCE THAT MADE THAT CANDIDATE AUTHORITATIVE.");
console.log("5A.30 canonical candidate provenance authority court: GREEN");
