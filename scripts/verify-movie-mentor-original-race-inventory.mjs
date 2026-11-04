import assert from "node:assert/strict";
import fs from "node:fs";
const durable=fs.readFileSync(new URL("./verify-movie-mentor-creator-state-durable-ownership-write-race.mjs",import.meta.url),"utf8");
const postcheck=fs.readFileSync(new URL("./verify-movie-mentor-creator-state-mongo-postcheck-revocation.mjs",import.meta.url),"utf8");
const adapter=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateMongoOperationAdapter.js",import.meta.url),"utf8");
assert.ok(adapter.includes('if(!ownerships)throw error("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_STORAGE_REQUIRED"'));
for(const [name,source] of [["durable-write-race",durable],["postcheck-revocation",postcheck]]){
 assert.ok(source.includes("states:instrumentedStates,operations});"),name+" remains an unfenced legacy test caller");
 assert.ok(source.includes('assert.notEqual(outcome?.kind,"accepted"'),name+" must retain no-accept assertion");
 assert.ok(source.includes("states.countDocuments"));
 assert.ok(source.includes("operations.countDocuments"));
 assert.ok(source.includes("MOVIE_MENTOR_CREATOR_STATE_OWNERSHIP_CHANGED"));
}
console.log("GREEN: original adversarial assertions remain intact; both legacy callers still omit mandatory ownership participant.");
console.log("LIMITATION: inventory is not a physical race verdict; RED workflows remain RED.");
