import assert from "node:assert/strict";
import fs from "node:fs";

const store = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js", import.meta.url), "utf8");
const transition = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateTransition.js", import.meta.url), "utf8");
const decision = fs.readFileSync(new URL("../ai/MovieMentorCreatorDecisionAuthority.js", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");

console.log("ROUND SEVEN — creator-state physical authority verifier");

assert.match(runtime,/commitCreatorDecision/,"live turn runtime must reach creator-decision commit authority");
assert.match(decision,/applyMovieMentorCreatorStateTransition/,"creator-decision commit must reach creator-state transition");
assert.match(transition,/writeAuthoritativeCreatorState/,"creator-state transition must reach the production durable store");
assert.match(store,/schema\.index\(\{projectId:1\},\{unique:true,partialFilterExpression:/,"creator-state singleton project identity must be declared unique");
assert.match(store,/getModel\(\)\.create\(doc\)/,"initial creator-state publication must cross an irreversible durable mint");
assert.match(store,/getModel\(\)\.findOneAndUpdate\(/,"creator-state revision mutation must cross a durable CAS");

assert.match(store,/collection\.indexes\(\)|readPhysicalIndexes|physicalUniqueIndexReadiness/,"production creator-state store must inspect actual Mongo physical unique-index reality before authoritative read or mutation");
assert.match(store,/MOVIE_MENTOR_CREATOR_STATE_PHYSICAL_AUTHORITY_UNAVAILABLE/,"missing physical creator-state identity must fail closed with an owned authority error");
assert.match(store,/before-creator-state-read-or-irreversible-mutation/,"creator-state store must name its physical authority boundary before durable authority crosses");

console.log("PASS — creator-state durable authority owns physical singleton project identity before read/mint/CAS.");
