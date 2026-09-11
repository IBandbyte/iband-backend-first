import assert from "node:assert/strict";
import fs from "node:fs";

const store = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateConsumptionRuntime.js", import.meta.url), "utf8");
const decision = fs.readFileSync(new URL("../ai/MovieMentorCreatorDecisionAuthority.js", import.meta.url), "utf8");
const transition = fs.readFileSync(new URL("../ai/MovieMentorCreatorStateTransition.js", import.meta.url), "utf8");
const gateway = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");

console.log("ROUND SEVEN — current-main creator-state physical authority court");

assert.match(server,/createMovieMentorTurnRouter|movieMentorTurn/,"production server must compose the creator turn surface");
assert.match(gateway,/runMovieMentorTurn|createMovieMentorTurnRouter/,"creator HTTP gateway must reach the live turn runtime");
assert.match(runtime,/readAuthoritativeTurnSource/,"live creator-state consumption runtime must read the durable creator-state authority");
assert.match(runtime,/commitCreatorDecision/,"live creator-state runtime must reach irreversible creator-decision publication");
assert.match(decision,/applyMovieMentorCreatorStateTransition/,"creator-decision authority must reach creator-state transition");
assert.match(transition,/writeAuthoritativeCreatorState/,"creator-state transition must reach the durable store");
assert.match(store,/schema\.index\(\{projectId:1\},\{unique:true,partialFilterExpression:\{projectId:\{\$type:\"string\"\}\}\}\)/,"declared singleton identity must be the unique partial projectId index");
assert.match(store,/getModel\(\)\.create\(doc\)/,"initial authoritative publication must cross a durable mint");
assert.match(store,/getModel\(\)\.findOneAndUpdate\(/,"subsequent authoritative publication must cross a durable revision CAS");

assert.match(store,/collection\.indexes\(\)|readPhysicalIndexes|physicalUniqueIndexReadiness/,"creator-state authority must inspect actual Mongo physical index reality before authoritative reads or mutation");
assert.match(store,/MOVIE_MENTOR_CREATOR_STATE_PHYSICAL_AUTHORITY_UNAVAILABLE/,"creator-state store must own an explicit fail-closed physical-authority error");
assert.match(store,/before-creator-state-read-or-irreversible-mutation/,"creator-state store must name the physical authority boundary before read, mint, or CAS");
assert.match(store,/partialFilterExpression/,"physical proof must preserve the declared projectId partial-index semantics rather than accepting an arbitrary unique key");

console.log("GREEN: production creator-state singleton authority is physically proven before authoritative read/mint/CAS.");
