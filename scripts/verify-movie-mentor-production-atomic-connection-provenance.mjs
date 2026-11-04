import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first source provenance court; never connects, starts server, or writes.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const store=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
const composition=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateAtomicComposition.js",import.meta.url),"utf8");
const canonical=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateCanonicalMongoConnection.js",import.meta.url),"utf8");
const gateway=server.match(/async function mountMovieMentorCreatorGateway\(\)\{([\s\S]*?)\}\s*await mountMovieMentorNativeProjectCreationIngress\(/)?.[1];
assert.ok(gateway,"Production creator gateway must remain discoverable.");
assert.match(store,/import mongoose from "mongoose"/,"Creator-state store must use the canonical Mongoose instance.");
assert.match(store,/mongoose\.connection\.readyState===1/,"Creator-state store must reuse the connected default Mongoose connection.");
assert.match(composition,/createMovieMentorCanonicalAtomicMongoConnection\(connection\)/,"Atomic composition must derive its client and database from supplied canonical connection.");
assert.match(canonical,/db\.client!==client/,"Canonical connection must reject mismatched Mongo client and database.");
const failures=[];
if(!/import mongoose from "mongoose"/.test(server))failures.push("RED: production startup must import the same Mongoose singleton as creator-state store.");
if(!/createMovieMentorCreatorStateAtomicCompositionFromMongoose\(mongoose\.connection\)/.test(gateway))failures.push("RED: production gateway must compose atomic readiness from canonical default Mongoose connection.");
for(const failure of failures)console.error(failure);
assert.equal(failures.length,0,"RED: canonical production connection provenance not established.");
console.log("GREEN: production atomic composition uses the canonical creator-state store Mongoose connection.");
