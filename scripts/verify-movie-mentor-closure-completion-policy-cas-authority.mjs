import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const start=source.indexOf("async function completeClosing("),end=source.indexOf("async function quarantineExecution(",start),body=source.slice(start,end);
assert.ok(start>=0&&end>start,"completeClosing production path must exist");
assert.match(body,/closurePolicyVersion/,"completeClosing CAS must bind the closure policy version being completed");
assert.match(body,/findOneAndUpdate\([\s\S]*closurePolicyVersion/,"closure policy must participate in the atomic CLOSING -> CLOSED write predicate");
console.log("GREEN: physical completion CAS binds closure policy identity.");
console.log("LAW: LOGICAL POLICY CHECKS CANNOT PROTECT A LATER IRREVERSIBLE WRITE UNLESS THE WRITE BINDS THE SAME POLICY.");
