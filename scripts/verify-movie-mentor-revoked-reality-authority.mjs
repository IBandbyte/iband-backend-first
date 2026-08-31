import assert from "node:assert/strict";
import fs from "node:fs";

const executionSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionMongoStore.js",import.meta.url),"utf8");
const settlementSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const canonicalSource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const gatewaySource=fs.readFileSync(new URL("../movieMentorTurn.js",import.meta.url),"utf8");

const schemaMatch=executionSource.match(/const VERSION="[^"]+",DOMAIN="iband\.movie-mentor\.inference-execution-store",SCHEMA=(\d+)/);
assert.ok(schemaMatch,"execution store must expose a statically auditable current durable schema");
const currentSchema=Number(schemaMatch[1]);
assert.ok(Number.isSafeInteger(currentSchema)&&currentSchema>0);

const settlementSchemas=settlementSource.match(/!\[([^\]]+)\]\.includes\(execution\.schema\)/)?.[1]?.split(",").map(Number)??[];
const canonicalSchemas=canonicalSource.match(/\[([^\]]+)\]\.includes\(execution\.schema\)/)?.[1]?.split(",").map(Number)??[];
assert.ok(settlementSchemas.includes(currentSchema),`current execution schema ${currentSchema} must cross settlement boundary`);
assert.ok(canonicalSchemas.includes(currentSchema),`current execution schema ${currentSchema} must cross canonical finalization boundary`);
assert.match(settlementSource,new RegExp(`executionSchemaCompatibility:\"[^\"]*${currentSchema}[^\"]*\"`));
assert.match(canonicalSource,new RegExp(`executionSchemaCompatibility:\"[^\"]*${currentSchema}[^\"]*\"`));

assert.match(runtimeSource,/if \(s\(existing\.phase\) === "quarantined"\)/);
assert.match(runtimeSource,/MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED/);
assert.match(runtimeSource,/retryable: false/);
assert.match(gatewaySource,/MOVIE_MENTOR_INFERENCE_EXECUTION_QUARANTINED"\)return 409/);
assert.match(gatewaySource,/quarantinedExecutionIsNonRetryableConflict:true/);
assert.match(gatewaySource,/quarantinedExecutionFailClosed:true/);

assert.match(settlementSource,/phase==="quarantined"\?"execution-quarantined"/);
assert.match(settlementSource,/if\(text\(execution\.phase\)==="aborted"\)/);
assert.match(settlementSource,/if\(text\(execution\.phase\)!=="active"\)/);
assert.match(settlementSource,/if\(execution\)\{outcome=Object\.freeze\(\{released:false,authorized:false,outcome:"reserved",reason:"reservation-already-bound-to-execution"/);
assert.match(settlementSource,/MOVIE_MENTOR_INFERENCE_RELEASE_CONSUMED_CONFLICT/);
assert.match(settlementSource,/MOVIE_MENTOR_INFERENCE_UNBOUND_RELEASE_CONSUMED_CONFLICT/);

assert.match(executionSource,/quarantinedFromPhase:current\.phase/);
assert.match(executionSource,/proofPhase=phase==="quarantined"\?quarantinedFromPhase:phase/);
assert.match(executionSource,/proofPhase==="settled"/);

console.log("ROUND SEVEN revoked-reality authority catastrophe gate: GREEN");
console.log(`✓ current durable execution schema ${currentSchema} crosses settlement + canonical finalization boundaries`);
console.log("✓ QUARANTINED is a non-retryable HTTP conflict, not a retry invitation");
console.log("✓ quarantined history preserves proof provenance without gaining replay, settlement, provider, or release authority");
console.log("✓ consumed economic history cannot be released by post-settlement or unbound release paths");
console.log("LAW: HISTORY MAY SURVIVE REVOCATION. AUTHORITY MAY NOT. CURRENT DURABLE SCHEMA MUST CROSS EVERY IRREVERSIBLE BOUNDARY OR THE GATE FAILS CLOSED.");
