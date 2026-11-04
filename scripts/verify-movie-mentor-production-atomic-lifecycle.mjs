import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first startup lifecycle court: no server import, connection, mount, or write.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const gateway=server.match(/async function mountMovieMentorCreatorGateway\(\)\{([\s\S]*?)\}\s*await mountMovieMentorNativeProjectCreationIngress\(/)?.[1];
assert.ok(gateway,"Canonical production creator gateway must remain discoverable.");
const failures=[];
const provenance=gateway.indexOf("createMovieMentorCreatorStateAtomicCompositionFromMongoose(mongoose.connection)");
const readiness=gateway.indexOf("assertMovieMentorCreatorGatewayAtomicMountReadiness(");
const router=gateway.indexOf("createMovieMentorTurnRouter({");
const mount=gateway.indexOf('app.use("/api/movie-mentor", router)');
if(!/mongoose\.connection\.readyState\s*!==\s*1/.test(gateway))failures.push("RED: gateway must explicitly deny mounting when canonical Mongoose connection is not connected.");
if(!(provenance>=0&&readiness>provenance&&router>readiness&&mount>router))failures.push("RED: canonical composition and atomic readiness gate must precede router construction and mounting.");
if(!/atomicCreatorStateReadiness\s*:/.test(gateway.slice(Math.max(0,router),Math.max(0,mount))))failures.push("RED: gateway must pass verified canonical readiness to router.");
if(!/requireAtomicCreatorStateOperation\s*:\s*true/.test(gateway.slice(Math.max(0,router),Math.max(0,mount))))failures.push("RED: gateway must explicitly enable strict router fail-closed mode.");
for(const failure of failures)console.error(failure);
assert.equal(failures.length,0,"RED: production creator gateway lifecycle is not yet fail-closed.");
console.log("GREEN: connected canonical composition, readiness gate, strict router, and mount are ordered fail-closed.");
