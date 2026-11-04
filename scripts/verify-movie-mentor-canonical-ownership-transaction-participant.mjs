import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// RED-first source contract. It is intentionally independent of mock revocation
// and must remain RED until canonical composition and the transaction adapter
// coordinate the same durable ownership record. This is not a physical verdict.
const adapter=readFileSync(new URL("../ai/MovieMentorCreatorStateMongoOperationAdapter.js",import.meta.url),"utf8");
const readiness=readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicReadiness.js",import.meta.url),"utf8");
const composition=readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicComposition.js",import.meta.url),"utf8");
assert.match(composition,/MOVIE_MENTOR_PROJECT_OWNERSHIP_COLLECTION|movie_mentor_project_ownership/,"RED: canonical composition must explicitly bind the durable ownership collection.");
assert.match(readiness,/ownerships|ownershipCollection/,"RED: readiness must pass ownership storage to the transaction adapter.");
assert.match(adapter,/ownerships|ownershipCollection/,"RED: adapter must receive ownership storage.");
assert.match(adapter,/ownerships\.(?:updateOne|findOneAndUpdate)\(/,"RED: transaction must write the ownership document to establish a MongoDB write conflict.");
assert.match(adapter,/\{\s*session\s*\}/,"RED: ownership fence must share the creator-state transaction session.");
console.log("GREEN source contract: canonical ownership transaction participant wired through composition, readiness, and adapter.");
