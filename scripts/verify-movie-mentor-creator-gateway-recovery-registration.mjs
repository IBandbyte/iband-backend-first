import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first startup recovery inventory. Never import server or touch network.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const startup=server.slice(server.indexOf("await mountMovieMentorNativeProjectCreationIngress();"));
assert.ok(startup.length>100,"Production startup sequence must exist.");
assert.match(startup,/await prepareMovieMentorCreatorMongoConnection\(\)/,"Canonical connection preparation must remain awaited.");
assert.match(startup,/await mountMovieMentorCreatorGateway\(\)/,"Initial strict gateway mount must remain awaited.");
const initial=startup.indexOf("await mountMovieMentorCreatorGateway()");
const listening=startup.indexOf("app.listen(",initial);
assert.ok(listening>initial,"HTTP listener must follow initial mount attempt.");
const recovery=startup.slice(initial+("await mountMovieMentorCreatorGateway()").length);
const repeated=/await mountMovieMentorCreatorGateway\(\)/.test(recovery);
const registered=/registerMovieMentorCreatorGatewayRecovery|scheduleMovieMentorCreatorGatewayRecovery|installMovieMentorCreatorGatewayRecovery/.test(startup);
assert.ok(repeated||registered,"RED: gateway startup denial has no explicit retry/remount recovery registration.");
console.log("GREEN: production startup registers a controlled creator gateway recovery path.");
