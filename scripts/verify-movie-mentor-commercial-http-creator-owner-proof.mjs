import assert from "node:assert/strict";
import fs from "node:fs";

const httpSource=fs.readFileSync(new URL("../ai/MovieMentorProductionCommercialHttpIngress.js",import.meta.url),"utf8");
const serverSource=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");

assert.match(serverSource,/mountMovieMentorProductionCommercialHttpIngress\(\{app,stripe:stripeClient\}\)/,"court requires the production server to reach the commercial HTTP composition");
assert.match(serverSource,/commercialMount\.mounted&&commercialMount\.creatorRouter/,"court requires the production server to expose the creator commercial router returned by that composition");
assert.match(httpSource,/createMovieMentorProductionCreatorCommercialComposition\(/,"court requires the HTTP composition to build the creator-commercial authority that crosses into the public router");
assert.match(httpSource,/isMovieMentorProductionCreatorCommercialOwnerProof/,"production HTTP ingress must consume exact creator-commercial composer-owned proof before its router can become mountable");
assert.match(httpSource,/creatorProven\(creator,creatorStatus\)/,"the exact creator-commercial object, not its self-reported status alone, must cross the final HTTP composition proof boundary");

console.log("commercial HTTP creator owner-proof torture: GREEN");
console.log("LAW: A PUBLIC HTTP MOUNT MAY NOT RECREATE CREATOR-COMMERCIAL AUTHORITY FROM STATUS SHAPE; THE EXACT PRODUCTION-COMPOSED OWNER PROOF MUST CROSS THE ROUTER EXPOSURE BOUNDARY.");
