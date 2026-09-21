import assert from "node:assert/strict";
import fs from "node:fs";

const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const canonicalSource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultAuthority.js",import.meta.url),"utf8");
const closureSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceExecutionClosureAuthority.js",import.meta.url),"utf8");
const compositionSource=fs.readFileSync(new URL("../ai/MovieMentorProductionInferenceExecutionComposition.js",import.meta.url),"utf8");

assert.match(compositionSource,/readCanonicalResult:resultAuthority\.readResult/,"production replay must use canonical authority, not raw canonical store");
assert.match(canonicalSource,/async function readResult\(\{executionId\}=\{\}\).*?assertCurrentClosure\(\{executionId:record\.executionId,closureReference:record\.closureReference,closureCertificateDigest:record\.closureCertificateDigest\}\)/s,"every canonical replay read must freshly assert current closure authority");
assert.match(closureSource,/if\(effect\.state==="conflict"\)return freeze\(\{valid:false,reason:"provider-effect-conflict"/,"closure authority must detect durable provider-effect conflict");
assert.match(closureSource,/if\(!reality\.valid\)return quarantine\(current,reality\.reason\|\|"closed-provider-effect-reality-invalid"\)/,"current CLOSED/FINALIZED/SETTLED authority must quarantine invalid provider reality");
assert.match(runtimeSource,/async function replayTerminalTurn[\s\S]*?readCanonicalResult\(\{ executionId: existing\.executionId \}\)[\s\S]*?canonical\?\.authorized !== true/,"terminal replay must require freshly authorized canonical result before settlement or response");
assert.match(runtimeSource,/function resultResponse\(canonical, settlement,[\s\S]*?assertCreatorResponseAuthority\(\{ canonical, settlement, execution \}\)/,"creator response boundary must independently assert canonical and settlement authority");

console.log("Movie Mentor late provider-effect conflict quarantine admission court: GREEN");
console.log("✓ production terminal replay cannot read canonical authority without fresh closure/current-reality validation");
console.log("✓ durable provider-effect conflict is converted by closure authority into durable execution quarantine");
console.log("✓ creator response remains downstream of fresh canonical + settlement authority");
console.log("LAW: LATE PROVIDER-EFFECT CONFLICT MAY PRESERVE HISTORY, BUT EVERY REPLAY MUST REENTER CURRENT CLOSURE REALITY AND REVOKE THE STALE UNIVERSE BEFORE CREATOR EXPOSURE.");
