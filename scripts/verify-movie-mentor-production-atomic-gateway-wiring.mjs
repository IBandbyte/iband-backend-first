import assert from "node:assert/strict";
import fs from "node:fs";

// Production source boundary inventory only: never import server, connect or mount.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const router=fs.readFileSync(new URL("../movieMentorTurn.js",import.meta.url),"utf8");
const gateway=server.match(/async function mountMovieMentorCreatorGateway\(\)\{([\s\S]*?)\}\s*await mountMovieMentorNativeProjectCreationIngress\(/)?.[1];
assert.ok(gateway,"Canonical production creator gateway must remain discoverable.");
assert.match(server,/createMovieMentorCreatorStateAtomicCompositionFromMongoose/,"RED: production must import canonical Mongoose atomic composition.");
assert.match(server,/assertMovieMentorCreatorGatewayAtomicMountReadiness/,"RED: production must import the verified mount gate.");
const gateAt=gateway.indexOf("assertMovieMentorCreatorGatewayAtomicMountReadiness(");
const mountAt=gateway.search(/app\.use\("\/api\/movie-mentor",\s*router\)/);
assert.ok(gateAt>=0&&mountAt>gateAt,"RED: verified atomic readiness gate must execute before production app.use.");
const routerAt=gateway.indexOf("createMovieMentorTurnRouter({");
assert.ok(routerAt>gateAt&&routerAt<mountAt,"RED: creator router must be constructed only after atomic gate passes.");
const routerArgs=gateway.slice(routerAt,mountAt);
assert.match(routerArgs,/atomicCreatorStateReadiness\s*:/,"RED: production router must receive canonical atomic readiness explicitly.");
assert.match(router,/router\.post\("\/state\/sync"[\s\S]*?atomicDepsFor\(authorized\)/,"State sync must obtain atomic dependencies.");
assert.match(router,/router\.post\("\/turn"[\s\S]*?atomicDepsFor\(authorized\)/,"Turn must obtain atomic dependencies.");
console.log("GREEN: production creator gateway source invokes atomic mount gate before router construction and app.use.");
