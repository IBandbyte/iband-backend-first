import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first source contract: a process-local freshness check cannot serialize
// ownership revocation against a creator-state transaction. No production I/O.
const adapter=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateMongoOperationAdapter.js",import.meta.url),"utf8");
const ownership=fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js",import.meta.url),"utf8");
assert.match(ownership,/ownershipTransfer:\s*false/,"Existing ownership registry explicitly disallows transfer; do not invent a production revocation API.");
assert.match(ownership,/collection:\s*MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION/,"Ownership registry must remain durable and identified.");
assert.match(adapter,/session\.withTransaction/,"Creator-state acceptance must remain transactional.");
assert.match(adapter,/await assertMovieMentorCreatorStateMutationAuthority/,"Fresh authority check must remain in place.");
assert.match(adapter,/ownerships\.(?:findOneAndUpdate|updateOne|findOne|replaceOne)\(/,"RED: creator-state transaction must touch a durable ownership fence in the same Mongo session.");
assert.match(adapter,/\{session[^}]*\}/,"RED: durable ownership fence must be transaction-session bound.");
console.log("GREEN: durable ownership fence participates in the creator-state transaction; check revocation writer coordination separately.");
