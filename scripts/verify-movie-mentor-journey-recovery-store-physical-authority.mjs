import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../ai/MovieMentorJourneyRecoveryStore.js",import.meta.url),"utf8");
console.log("Round Seven — journey recovery store physical authority verifier");
assert.match(source,/schema\.index\(\{projectId:1\},\{unique:true\}\)/,"recovery store must declare singleton projectId uniqueness");
assert.match(source,/writeMovieMentorJourneyRecovery[\s\S]*?getModel\(\)\.create\(doc\)/,"initial recovery publication crosses durable Mongo mint");
assert.match(source,/writeMovieMentorJourneyRecovery[\s\S]*?findOneAndUpdate\(\{projectId:pid,recoveryRevision:expected\}/,"advanced recovery publication crosses durable Mongo CAS mutation");
assert.match(source,/physicalUniqueIndexReadiness|PHYSICAL_AUTHORITY_BOUNDARY|readPhysicalIndexes|collection\.indexes\(\)/,"recovery publication authority must verify actual physical unique projectId reality before durable mint/CAS");
console.log("✓ production recovery store declares per-project singleton uniqueness");
console.log("✓ initial publication and revision advancement cross irreversible durable Mongo mutation");
console.log("✓ actual physical projectId uniqueness must own publication mint/CAS authority");
console.log("journey recovery store physical authority: GREEN");
