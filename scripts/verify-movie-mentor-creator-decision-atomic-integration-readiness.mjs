import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const load=async name=>readFile(new URL("../ai/"+name,import.meta.url),"utf8");
const [runtime,transition,writer,execution]=await Promise.all(["MovieMentorTurnRuntime.js","MovieMentorCreatorStateTransition.js","MovieMentorCreatorStateStore.js","MovieMentorInferenceExecutionMongoStore.js"].map(load));
const block=runtime.slice(runtime.indexOf("let orchestrationDeps = { readAuthoritativeRevision:"),runtime.indexOf("let result;",runtime.indexOf("let orchestrationDeps = { readAuthoritativeRevision:")));
assert.ok(block.length>0&&block.includes("commitCreatorDecision: deps.commitCreatorDecision"));
const facts={
 postAcquisitionCommitDirectlyForwarded:block.includes("commitCreatorDecision: deps.commitCreatorDecision"),
 transitionForwardsSession:/return write\(next,\{[^}]*session\s*:/.test(transition),
 writerInitialCreateSession:/getModel\(\)\.create\(doc,\s*\{\s*session/.test(writer),
 writerUpdateSession:/findOneAndUpdate\([\s\S]*?\{new:true,runValidators:true,session\s*[:},]/.test(writer),
 executionSchemaDeclaresCreatorDecisionBarrier:execution.includes("creatorDecisionBarrierRevision")
};
console.log(JSON.stringify({court:"creator-decision-atomic-integration-readiness",classification:"audit-only structural readiness; not MongoDB physical court",facts}));
assert.equal(facts.postAcquisitionCommitDirectlyForwarded,false,"STRUCTURAL RED: creator commit still directly forwarded");
assert.equal(facts.transitionForwardsSession,true,"STRUCTURAL RED: transition drops session");
assert.equal(facts.writerInitialCreateSession,true,"STRUCTURAL RED: initial-create writer drops session");
assert.equal(facts.writerUpdateSession,true,"STRUCTURAL RED: update writer drops session");
assert.equal(facts.executionSchemaDeclaresCreatorDecisionBarrier,true,"STRUCTURAL RED: strict execution schema lacks dedicated barrier");
console.log("PASS: all creator-decision atomic integration prerequisites structurally present");
