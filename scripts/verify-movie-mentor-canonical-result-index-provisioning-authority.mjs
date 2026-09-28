import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
console.log("Movie Mentor canonical result index provisioning authority court");
for(const declaration of [
  /schema\.index\(\{resultReference:1\},\{unique:true\}\)/,
  /schema\.index\(\{candidateReference:1\},\{unique:true\}\)/,
  /schema\.index\(\{executionId:1\},\{unique:true\}\)/,
  /schema\.index\(\{principalId:1,projectId:1,creatorTurnId:1\},\{unique:true\}\)/,
  /schema\.index\(\{reservationId:1\},\{unique:true\}\)/
]) assert.match(source,declaration);
const readiness=source.slice(source.indexOf("async function physicalUniqueIndexReadiness"),source.indexOf("async function crossLedgerPhysicalUniqueIndexReadiness"));
assert.match(readiness,/createIndexes\(\)/,"canonical result readiness must explicitly provision its declared unique indexes before trusting the physical catalogue");
assert.ok(readiness.indexOf("createIndexes()")>=0&&readiness.indexOf(".indexes()")>readiness.indexOf("createIndexes()"),"canonical result provisioning must precede physical catalogue observation");
console.log("PASS canonical result index provisioning authority — production store provisions all declared result identity fences before physical readiness.");
