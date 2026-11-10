import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../server.js",import.meta.url),"utf8");
const startup=source.slice(source.indexOf("const initialCreatorGatewayMount="),source.indexOf("const recoveryMount="));
assert.match(startup,/registerMovieMentorCreatorGatewayRecovery\(/,"RED: creator gateway recovery registration must exist");
assert.match(startup,/mountMovieMentorReadOnlyRecoveryIngress\(\)/,"RED: read-only recovery must mount on initial startup");
assert.match(startup,/onResult\s*:\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_$][\w$]*)\s*=>[\s\S]*?mountMovieMentorReadOnlyRecoveryIngress\(/,"RED: recovered Mongo/gateway readiness must retry read-only ingress mounting, not leave it permanently closed");
console.log("GREEN: read-only creator recovery ingress reattempts mounting after gateway recovery");
