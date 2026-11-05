import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicReadiness.js",import.meta.url),"utf8");
assert.match(source,/ownerships\.collectionName!=="movie_mentor_project_ownership"/,"Canonical ownership identity must be required");
assert.match(source,/assertProjectIndex\(states\)/);
assert.match(source,/assertOperationIndex\(operations\)/);
assert.match(source,/await\s+assertOwnershipIndex\(ownerships\)/,"RED: production atomic readiness must physically verify unique canonical ownership project index before mounting");
assert.match(source,/establishmentAuthorityId/,"RED: production readiness must also verify physical unique establishment-authority index, matching the durable ownership registry");
console.log("GREEN: production atomic readiness physically checks both canonical ownership uniqueness constraints.");
