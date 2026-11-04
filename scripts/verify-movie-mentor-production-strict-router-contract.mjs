import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first production source contract. No server import, Mongo connection, or mount.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const gateway=server.match(/async function mountMovieMentorCreatorGateway\(\)\{([\s\S]*?)\}\s*await mountMovieMentorNativeProjectCreationIngress\(/)?.[1];
assert.ok(gateway,"Canonical creator gateway must remain discoverable.");
const routerAt=gateway.indexOf("createMovieMentorTurnRouter({");
const mountAt=gateway.indexOf('app.use("/api/movie-mentor", router)');
assert.ok(routerAt>=0&&mountAt>routerAt,"Production router must be constructed before mount.");
const routerArgs=gateway.slice(routerAt,mountAt);
const failures=[];
if(!/requireAtomicCreatorStateOperation\s*:\s*true/.test(routerArgs))failures.push("RED: production creator router must explicitly request strict fail-closed atomic operation authority.");
if(!/atomicCreatorStateReadiness\s*:/.test(routerArgs))failures.push("RED: production creator router must explicitly receive canonical atomic readiness.");
for(const failure of failures)console.error(failure);
assert.equal(failures.length,0,"RED: production strict router configuration gaps: "+failures.join("; "));
console.log("GREEN: production creator router requests strict fail-closed atomic authority and readiness.");
