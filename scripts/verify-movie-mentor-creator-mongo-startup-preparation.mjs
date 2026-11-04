import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first contract inventory: this never imports Mongoose or connects to Mongo.
const server=fs.readFileSync(new URL("../server.js",import.meta.url),"utf8");
const helperPath=new URL("../ai/MovieMentorCreatorMongoStartupPreparation.js",import.meta.url);
assert.ok(fs.existsSync(helperPath),"RED: canonical Mongo startup preparation helper must exist.");
const helper=fs.readFileSync(helperPath,"utf8");
assert.match(helper,/import mongoose from "mongoose"/,"RED: helper must use canonical Mongoose singleton.");
assert.match(helper,/MONGO_URI/,"RED: helper must recognize configured canonical Mongo URI.");
assert.match(helper,/MONGODB_URI/,"RED: helper must recognize alternate canonical Mongo URI.");
assert.match(helper,/const connection=mongoose\.connection/,"RED: helper must bind the canonical Mongoose connection.");
assert.match(helper,/connection\.readyState/,"RED: helper must inspect canonical connection readiness.");
assert.match(helper,/mongoose\.connect\(/,"RED: helper must establish the canonical connection when needed.");
assert.match(helper,/catch/,"RED: connection failure must be caught and reported fail-closed.");
assert.match(server,/await (?:assert|ensure|initialize|establish|prepare)[A-Za-z0-9]*Creator[A-Za-z0-9]*Mongo[A-Za-z0-9]*\(/,"RED: production startup must await canonical Mongo preparation.");
console.log("GREEN: canonical Mongo startup helper is explicitly awaited with failure handling.");
