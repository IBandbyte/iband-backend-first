import assert from "node:assert/strict";
import fs from "node:fs";
import { createDerivedContinuityConstraint } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createContinuityDerivedCacheRecord } from "../ai/MovieMentorContinuityDerivedCacheControl.js";
import { writeContinuityDerivedCache } from "../ai/MovieMentorContinuityDerivedCacheStore.js";

console.log("Round Seven — continuity cache physical authority verifier");

const storeSource = fs.readFileSync(new URL("../ai/MovieMentorContinuityDerivedCacheStore.js", import.meta.url), "utf8");
const specialistSource = fs.readFileSync(new URL("../ai/MovieMentorSpecialistExecutor.js", import.meta.url), "utf8");
const runtimeSource = fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js", import.meta.url), "utf8");
const gatewaySource = fs.readFileSync(new URL("../movieMentorTurn.js", import.meta.url), "utf8");

// Production reachability must remain explicit: creator HTTP -> guarded turn runtime ->
// live Continuity specialist -> default durable continuity-cache store -> project-head upsert.
assert.match(gatewaySource, /runMovieMentorTurnWithForwardExecutionAuthority/);
assert.match(runtimeSource, /executeMovieMentorSpecialistWorkOrder/);
assert.match(specialistSource, /readReusableContinuityDerivedCache, writeContinuityDerivedCache/);
assert.match(specialistSource, /deps\.writeContinuityDerivedCache \|\| writeContinuityDerivedCache/);
assert.match(storeSource, /schema\.index\(\{projectHeadKey:1\},\{unique:true,sparse:true\}\)/,
  "continuity cache must declare one sparse unique project-head identity");
assert.match(storeSource, /findOneAndUpdate\(filter,\{\$set:doc\},\{upsert:true/,
  "continuity cache project-head write is an irreversible unique-identity-dependent upsert");

const truth = [
  { key:"creatorDecision.semantic.character.mayaAge", value:17, authority:"creator", confidenceSource:"creator-confirmed", decisionKey:"semantic.character.mayaAge", decisionId:"age-17", decisionFingerprint:"a".repeat(64), current:true },
  { key:"creatorDecision.semantic.timeline.jump", value:10, authority:"creator", confidenceSource:"creator-confirmed", decisionKey:"semantic.timeline.jump", decisionId:"jump-10", decisionFingerprint:"b".repeat(64), current:true },
];
const state = { projectId:"physical-cache-project", revision:9, creatorStateGeneration:5, creatorStateFingerprint:"d".repeat(64), snapshotReference:"snap-9" };
const constraint = createDerivedContinuityConstraint({
  category:"timeline", key:"character.maya.age.current", value:27,
  reason:"Age after the creator-confirmed ten-year jump.", confidence:1,
  dependencies:[{key:truth[0].key,value:truth[0].value},{key:truth[1].key,value:10}],
}, truth);
const record = createContinuityDerivedCacheRecord({ sourceState:state, creatorConfirmedContext:truth, constraints:[constraint] });

function successfulQuery(value) {
  return { lean(){ return this; }, async exec(){ return structuredClone(value); } };
}

// Court 1: declared schema uniqueness is not physical authority. If Mongo reports no
// matching physical index, the store must fail closed BEFORE the durable upsert.
let missingIndexReads = 0;
let missingIndexMutations = 0;
const missingIndexModel = {
  collection:{ async indexes(){ missingIndexReads += 1; return [{ key:{_id:1}, name:"_id_" }]; } },
  findOneAndUpdate(){ missingIndexMutations += 1; return successfulQuery({...record,projectHeadKey:record.projectId}); },
};
await assert.rejects(
  () => writeContinuityDerivedCache(record,state,truth,{model:missingIndexModel}),
  error => error?.code === "MOVIE_MENTOR_CONTINUITY_CACHE_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "continuity cache must fail closed when its physical sparse unique projectHeadKey index is absent",
);
assert.equal(missingIndexReads,1,"continuity cache must inspect actual Mongo index reality");
assert.equal(missingIndexMutations,0,"no continuity-cache durable mutation may precede physical uniqueness proof");

// Court 2: wrong semantics are not authority: same key without unique+sparse must fail closed.
let wrongSemanticsMutations = 0;
const wrongSemanticsModel = {
  collection:{ async indexes(){ return [{ key:{projectHeadKey:1}, unique:true, sparse:false, name:"wrong_semantics" }]; } },
  findOneAndUpdate(){ wrongSemanticsMutations += 1; return successfulQuery({...record,projectHeadKey:record.projectId}); },
};
await assert.rejects(
  () => writeContinuityDerivedCache(record,state,truth,{model:wrongSemanticsModel}),
  error => error?.code === "MOVIE_MENTOR_CONTINUITY_CACHE_PHYSICAL_AUTHORITY_UNAVAILABLE",
  "continuity cache must require the exact sparse unique semantics used by legacy/project-head coexistence",
);
assert.equal(wrongSemanticsMutations,0);

// Court 3: exact physical authority permits the upsert, and readiness is cached per
// physical model/store universe so retries do not repeatedly invent authority.
let exactIndexReads = 0;
let exactMutations = 0;
const exactModel = {
  collection:{ async indexes(){ exactIndexReads += 1; return [{ key:{projectHeadKey:1}, unique:true, sparse:true, name:"projectHeadKey_1" }]; } },
  findOneAndUpdate(){ exactMutations += 1; return successfulQuery({...record,projectHeadKey:record.projectId}); },
};
await writeContinuityDerivedCache(record,state,truth,{model:exactModel});
await writeContinuityDerivedCache(structuredClone(record),structuredClone(state),structuredClone(truth),{model:exactModel});
assert.equal(exactIndexReads,1,"physical uniqueness readiness should be cached after proof for the same model universe");
assert.equal(exactMutations,2);

console.log("Movie Mentor continuity cache physical authority: GREEN — production-reachable project-head CAS/upsert proves exact sparse unique Mongo authority before any durable mutation and caches that readiness.");
