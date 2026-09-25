import assert from "node:assert/strict";
import fs from "node:fs";

console.log("5A.46 — Legacy zero ↔ first compensation / Creator transition serialization");

const legacy=Object.freeze({
  projectId:"project-345",revision:8,revisionAuthorityReference:"revision-8",
  snapshotReference:"snapshot-8",creatorStateGeneration:8,
  creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:"creator-8"
});
assert.equal(Object.hasOwn(legacy,"compensationBarrierRevision"),false,
  "fixture must be physically pre-barrier");

function transitionFilter(expectedBarrier=0){
  return row=>row.projectId===legacy.projectId&&row.revision===8&&
    (expectedBarrier===0
      ? row.compensationBarrierRevision===0||!Object.hasOwn(row,"compensationBarrierRevision")
      : row.compensationBarrierRevision===expectedBarrier);
}
function compensationFilter(row){
  return row.projectId===legacy.projectId&&row.revision===8&&
    row.revisionAuthorityReference==="revision-8"&&row.snapshotReference==="snapshot-8"&&
    row.creatorStateGeneration===8&&row.creatorStateFingerprint==="b".repeat(64)&&
    row.creatorAuthorityReference==="creator-8";
}
function creatorWrite(row){
  if(!transitionFilter(0)(row))return false;
  Object.assign(row,{revision:9,revisionAuthorityReference:"revision-9",
    snapshotReference:"snapshot-9",creatorStateGeneration:9,
    creatorStateFingerprint:"c".repeat(64),creatorAuthorityReference:"creator-9",
    compensationBarrierRevision:0});
  return true;
}
function compensationWrite(row){
  if(!compensationFilter(row))return false;
  row.compensationBarrierRevision=(Number.isSafeInteger(row.compensationBarrierRevision)?row.compensationBarrierRevision:0)+1;
  return true;
}

// Mongo single-document writes are atomic: model both legal winner orders.
{
  const row=structuredClone(legacy);
  assert.equal(creatorWrite(row),true,"legacy transition may win and materialize zero");
  assert.equal(compensationWrite(row),false,
    "compensation carrying the old Creator universe must lose after transition wins");
  assert.equal(row.revision,9); assert.equal(row.compensationBarrierRevision,0);
}
{
  const row=structuredClone(legacy);
  assert.equal(compensationWrite(row),true,"first compensation may win and materialize one");
  assert.equal(creatorWrite(row),false,
    "zero-compatible transition must lose after compensation materializes nonzero fence");
  assert.equal(row.revision,8); assert.equal(row.compensationBarrierRevision,1);
  // A retry/read sees one; it cannot use the legacy-missing arm.
  assert.equal(transitionFilter(1)(row),true,"retry carrying current barrier one may proceed exactly");
  assert.equal(transitionFilter(0)(row),false,"stale logical zero may never match barrier one");
}

const store=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
assert.match(store,/doc\.compensationBarrierRevision===0\?\{\$or:\[\{compensationBarrierRevision:0\},\{compensationBarrierRevision:\{\$exists:false\}\}\]\}:\{compensationBarrierRevision:doc\.compensationBarrierRevision\}/,
  "Creator CAS must admit missing only for logical zero");
assert.match(settlement,/creatorStates\.updateOne\(\{projectId:text\(execution\.projectId\),revision:durableCurrentUniverse\.revision,[\s\S]*?creatorAuthorityReference:text\(durableCurrentUniverse\.creatorStateAuthorityReference\)\},\{\$inc:\{compensationBarrierRevision:1\}\},\{session\}\)/,
  "compensation must atomically increment the exact Creator-state universe inside its transaction");

console.log("GREEN: either legacy-zero transition or first compensation may win, but the loser cannot commit stale authority.");
console.log("LAW: MISSING MAY REPRESENT ZERO ONLY UNTIL THE FIRST ATOMIC WRITER MATERIALIZES ZERO OR ONE; AFTER THAT, CURRENT PHYSICAL AUTHORITY DECIDES.");
