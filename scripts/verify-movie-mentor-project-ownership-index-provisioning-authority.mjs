import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js",import.meta.url),"utf8");

console.log("Movie Mentor project ownership index provisioning authority court");
assert.match(source,/schema\.index\(\{ projectId: 1 \}, \{ unique: true \}\)/);
assert.match(source,/schema\.index\(\{ establishmentAuthorityId: 1 \}, \{ unique: true \}\)/);
assert.match(source,/ensureMovieMentorProjectOwnershipPhysicalUniqueIndexReadiness/);
assert.match(source,/collection\(MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION\)\.indexes\(\)/);
assert.match(source,/createIndexes\(\)/,"project ownership readiness must explicitly provision declared schema indexes before trusting the physical catalogue");
const readiness=source.slice(source.indexOf("async function ensureMovieMentorProjectOwnershipPhysicalUniqueIndexReadiness"),source.indexOf("function inspectMovieMentorProjectOwnership"));
assert.ok(readiness.indexOf("createIndexes()")>=0&&readiness.indexOf(".indexes()")>readiness.indexOf("createIndexes()"),"provisioning must precede physical catalogue observation");
console.log("PASS project ownership index provisioning authority — production registry provisions both authority-bearing unique indexes before physical readiness.");
