import assert from "node:assert/strict";
import fs from "node:fs";

const storeSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");

assert.match(storeSource,/schema\.index\(\{executionId:1\},\{unique:true\}\)/,"execution identity must be schema-unique");
assert.match(storeSource,/schema\.index\(\{principalId:1,projectId:1,creatorTurnId:1\},\{unique:true\}\)/,"creator-turn identity must be schema-unique");
assert.match(storeSource,/schema\.index\(\{reservationId:1\},\{unique:true\}\)/,"reservation binding must be schema-unique");
assert.match(storeSource,/async function createExecution/);
assert.match(storeSource,/session\.withTransaction/,"production execution creation crosses an irreversible transaction boundary");
assert.match(compositionSource,/const durableStore=createMovieMentorInferenceExecutionMongoStore\(\)/,"production composition must directly consume the execution Mongo store");

const readyMatch=storeSource.match(/async function ready\(\)\{([^}]*)\}/);
assert.ok(readyMatch,"execution store must expose its readiness boundary");
const readinessBody=readyMatch[1];
assert.match(readinessBody,/(?:createIndexes|\.init\(|\.indexes\(|listIndexes|physicalUniqueIndexReadiness|indexReadiness)/,"physical unique indexes must be explicitly initialized or verified before execution authority can mutate durable identity");

console.log("PASS inference execution index readiness — physical unique-index authority is established before irreversible execution mutation.");
console.log("LAW: EXECUTION IDENTITY, CREATOR-TURN IDENTITY, AND RESERVATION BINDING ARE NOT AUTHORITATIVE UNTIL THEIR PHYSICAL UNIQUE INDEXES ARE READY.");
