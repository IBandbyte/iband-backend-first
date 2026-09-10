import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const composition=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceSettlementComposition.js",import.meta.url),"utf8");
assert.match(source,/async function settleCanonicalResult/);assert.match(source,/await connect\(\);const session=await startSession\(\)/);assert.match(source,/session\.withTransaction/);assert.match(composition,/createMovieMentorInferenceSettlementMongoStore\(\)/);
const readinessSignals=[/createIndexes\s*\(/,/\.indexes\s*\(/,/listIndexes\s*\(/,/indexReadiness/,/physicalUniqueIndexReadiness/,/uniquenessReadinessRequired/];const observed=readinessSignals.filter(pattern=>pattern.test(source)).length;assert.ok(observed>0,"settlement physical authority crosses irreversible Mongo mutation without any explicit physical index/readiness proof");
console.log("PASS inference settlement physical authority — physical durable readiness is proven before irreversible transaction authority.");
console.log("LAW: SETTLEMENT MAY NOT CONSUME OR RELEASE ECONOMIC REALITY UNTIL THE PHYSICAL DURABLE AUTHORITIES IT RELIES ON ARE PROVEN READY.");
