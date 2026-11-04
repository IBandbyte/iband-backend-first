import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first source lifecycle inventory. No imports of production modules, network, or writes.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const store=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
const ownership=fs.readFileSync(new URL("../ai/MovieMentorProjectOwnershipRegistry.js",import.meta.url),"utf8");
const startup=server.slice(server.indexOf("await mountMovieMentorNativeProjectCreationIngress();"));
assert.match(store,/mongoose\.connect\(uri,/,"Creator state store must retain canonical lazy Mongoose connection.");
assert.match(ownership,/mongoose\.connect\(uri,/,"Ownership registry must retain canonical lazy Mongoose connection.");
assert.match(startup,/await mountMovieMentorCreatorGateway\(\)/,"Production creator gateway must remain in startup sequence.");
const gatewayAt=startup.indexOf("await mountMovieMentorCreatorGateway()");
const prior=startup.slice(0,gatewayAt);
const failures=[];
if(!/await (?:assert|ensure|initialize|establish|prepare)[A-Za-z0-9]*Creator[A-Za-z0-9]*Mongo[A-Za-z0-9]*\(/.test(prior))
 failures.push("RED: no explicit awaited canonical creator Mongo connection preparation before gateway mount.");
if(!/mongoose\.connection\.readyState\s*!==\s*1/.test(server))
 failures.push("RED: disconnected canonical connection must still deny gateway mounting.");
for(const failure of failures)console.error(failure);
assert.equal(failures.length,0,"RED: fresh-process creator gateway startup availability has no proven connection preparation.");
console.log("GREEN: canonical creator Mongo startup preparation precedes fail-closed gateway mount.");
