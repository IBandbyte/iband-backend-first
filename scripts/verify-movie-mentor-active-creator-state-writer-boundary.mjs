import assert from "node:assert/strict";
import fs from "node:fs";

// RED-first inventory court. Source only; no imports of runtime/server or DB operations.
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const transition=read("ai/MovieMentorCreatorStateTransition.js");
const decision=read("ai/MovieMentorCreatorDecisionAuthority.js");
const consumption=read("ai/MovieMentorCreatorStateConsumptionRuntime.js");
const turn=read("movieMentorTurn.js");
const runtime=read("ai/MovieMentorTurnRuntime.js");
assert.match(turn,/router\.post\("\/state\/sync"[\s\S]*?atomicDepsFor\(authorized\)/);
assert.match(turn,/router\.post\("\/turn"[\s\S]*?atomicDepsFor\(authorized\)/);
assert.match(turn,/commitDecision=\(input,deps=\{\}\)=>commitCreatorDecision\(input,\{\.\.\.deps,creatorStateMutationAuthority,\.\.\.atomicDeps\}\)/);
assert.match(runtime,/commitCreatorDecision:\s*deps\.commitCreatorDecision/);
assert.match(consumption,/const baseCommit = deps\.commitCreatorDecision \|\| commitCreatorDecision/);
assert.match(decision,/deps\.atomicAcceptCreatorStateOperation/);
assert.match(transition,/if\(deps\.atomicAcceptCreatorStateOperation\)/);
assert.doesNotMatch(transition,/const read=deps\.readAuthoritativeTurnSource\|\|readAuthoritativeTurnSource,write=deps\.writeAuthoritativeCreatorState\|\|writeAuthoritativeCreatorState/,"RED: transition still permits direct non-ledger authoritative writes without atomic adapter.");
console.log("GREEN: active creator-state mutation graph has no legacy direct writer fallback.");
