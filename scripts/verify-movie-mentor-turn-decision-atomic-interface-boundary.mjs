import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source-contract mapping court only: this does not simulate a physical race.
// Freeze the distinction between /turn decision commitment and /state/sync.
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const gateway = read("movieMentorTurn.js");
const decision = read("ai/MovieMentorCreatorDecisionAuthority.js");
const transition = read("ai/MovieMentorCreatorStateTransition.js");
const creatorStore = read("ai/MovieMentorCreatorStateStore.js");
const executionStore = read("ai/MovieMentorInferenceExecutionMongoStore.js");
assert.match(gateway, /router\.post\("\/turn"/);
assert.match(gateway, /commitDecision=\(input,deps=\{\}\)=>commitCreatorDecision\(input,\{\.\.\.deps,creatorStateMutationAuthority\}\)/);
assert.match(gateway, /router\.post\("\/state\/sync"/);
assert.match(gateway, /state=await applyStateTransition\(authorized\.body,\{creatorStateMutationAuthority\}\)/);
assert.match(decision, /source:"creator-decision"/);
assert.match(decision, /writeAuthoritativeCreatorState:deps\.writeAuthoritativeCreatorState/);
assert.match(transition, /write=deps\.writeAuthoritativeCreatorState\|\|writeAuthoritativeCreatorState/);
assert.match(creatorStore, /findOneAndUpdate\(\{\.\.\.identity,revision:expected/);
assert.match(executionStore, /function createMovieMentorInferenceExecutionMongoStore\(\{mongoModel=null,connect=ensureConnection,startSession=/);
assert.match(executionStore, /async function replaceExecution\(/);
assert.match(executionStore, /\$\$NOW/);
// Record the absence of an integrated creator-decision transaction API;
// fail on a future change so the contract must be reviewed, not assumed.
assert.doesNotMatch(executionStore, /commitCreatorDecisionAtomically/);
assert.doesNotMatch(creatorStore, /commitCreatorDecisionAtomically/);
console.log(JSON.stringify({
  court: "turn-decision-atomic-interface-boundary",
  turn: "creator decision uses independently injected creator mutation authority",
  sync: "standalone state-sync retains its separate mutation path",
  creatorStore: "revision CAS is independent",
  executionStore: "session factory exists but no public atomic creator-decision operation",
  verdict: "integration-gap-confirmed; no physical race tested",
}));
console.log("PASS: production source contract distinguishes turn decision from standalone state sync");
