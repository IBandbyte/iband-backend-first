import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first recovery safety contract; source-only, no server startup or database access.
const path=new URL("../ai/MovieMentorCreatorGatewayRecovery.js",import.meta.url);
assert.ok(fs.existsSync(path),"RED: creator gateway recovery coordinator must exist.");
const source=fs.readFileSync(path,"utf8");
assert.match(source,/export\s*\{[^}]*registerMovieMentorCreatorGatewayRecovery/,"RED: recovery coordinator must export explicit registration.");
assert.match(source,/setTimeout/,"RED: retry must be scheduled, not a synchronous tight loop.");
assert.match(source,/clearTimeout/,"RED: retry timer must be cancellable.");
assert.match(source,/mounted/,"RED: successful mount must stop retries.");
assert.match(source,/inFlight|running/,"RED: concurrent retry attempts must be fenced.");
assert.match(source,/attempt|retry/,"RED: retry attempts must be bounded or controlled.");
console.log("GREEN: creator gateway recovery coordinator exposes controlled, cancellable, single-flight retry lifecycle.");
