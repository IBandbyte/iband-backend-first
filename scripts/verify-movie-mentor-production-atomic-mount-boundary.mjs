import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first, source-bound production startup court. No server import,
// database connection, network call, route mount or production write.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const gateway=server.match(/async function mountMovieMentorCreatorGateway\(\)\{([\s\S]*?)\}\s*await mountMovieMentorNativeProjectCreationIngress\(/)?.[1];
assert.ok(gateway,"Production creator gateway mount function must remain discoverable.");
assert.match(server,/createMovieMentorCreatorStateAtomicComposition/,"RED: production startup must import canonical atomic creator-state composition.");
assert.match(gateway,/atomicCreatorStateReadiness/,"RED: creator gateway must require and forward atomic readiness.");
const routerCall=gateway.match(/createMovieMentorTurnRouter\(\{([\s\S]*?)\}\)/)?.[1];
assert.ok(routerCall,"Production gateway must construct the canonical creator turn router.");
assert.match(routerCall,/atomicCreatorStateReadiness\s*:/,"RED: gateway router construction must explicitly bind atomic readiness.");
const mountPosition=gateway.indexOf('app.use("/api/movie-mentor", router)');
assert.ok(mountPosition>=0,"Canonical gateway mount must remain explicit.");
const readinessPosition=gateway.indexOf("atomicCreatorStateReadiness");
assert.ok(readinessPosition>=0&&readinessPosition<mountPosition,"RED: atomic readiness must be checked before creator gateway mounting.");
console.log("GREEN: production creator gateway source explicitly composes and requires atomic readiness before mount.");
