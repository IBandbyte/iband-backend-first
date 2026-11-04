import assert from "node:assert/strict";
import fs from "node:fs";

// Source wiring court; no server startup, HTTP requests or database access.
const source=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const gateway=source("movieMentorTurn.js");
const decision=source("ai/MovieMentorCreatorDecisionAuthority.js");
const transition=source("ai/MovieMentorCreatorStateTransition.js");
assert.match(gateway,/return\{principalId,atomicAcceptCreatorStateOperation,requireAtomicCreatorStateOperation:true\}/,"Atomic readiness must mark HTTP mutation strict.");
assert.match(gateway,/router\.post\("\/state\/sync"[\s\S]*?atomicDeps=await atomicDepsFor\(authorized\)[\s\S]*?applyStateTransition\(authorized\.body,\{creatorStateMutationAuthority,\.\.\.atomicDeps\}\)/,"Sync must forward strict atomic deps.");
assert.match(gateway,/router\.post\("\/turn"[\s\S]*?atomicDeps=await atomicDepsFor\(authorized\)[\s\S]*?commitCreatorDecision\(input,\{\.\.\.deps,creatorStateMutationAuthority,\.\.\.atomicDeps\}\)/,"Turn decision must forward strict atomic deps.");
assert.match(decision,/deps\.requireAtomicCreatorStateOperation===true\?\{requireAtomicCreatorStateOperation:true\}:\{\}/,"Decision transition must propagate strict requirement.");
assert.match(transition,/deps\.requireAtomicCreatorStateOperation===true\|\|s\(input\.operationId\)/,"Strict mode or operation-bearing requests must require the atomic adapter.");
assert.match(transition,/typeof deps\.atomicAcceptCreatorStateOperation!=="function"\)throw fail\("MOVIE_MENTOR_CREATOR_STATE_ATOMIC_READINESS_REQUIRED"/,"Missing atomic adapter must fail closed.");
console.log("GREEN: strict atomic dependency propagation is present in both HTTP mutation routes and decision transition.");
