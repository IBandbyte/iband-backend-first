import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import { writeAuthoritativeCreatorState } from "../ai/MovieMentorCreatorStateStore.js";
import {
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
  MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA
} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

console.log("5A.46 — Legacy zero ↔ first compensation / Creator transition physical serialization");

const projectId="project-345";
const legacy=Object.freeze({
  projectId,creatorSessionId:"session-345",revision:8,revisionAuthorityReference:"revision-8",
  snapshotReference:"snapshot-8",creatorStateGeneration:8,
  creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:"creator-8",
  creatorConfirmedContext:[],projectJourney:null,memoryContext:null,responseBlueprint:null,
  communicationPlan:null,capturedAt:new Date("2026-01-01T00:00:00.000Z")
});
assert.equal(Object.hasOwn(legacy,"compensationBarrierRevision"),false,"fixture must be physically pre-barrier");

const authority=Object.freeze({
  domain:MOVIE_MENTOR_CREATOR_STATE_MUTATION_AUTHORITY_DOMAIN,
  schema:MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
  principalId:"creator-345",projectId,
  assertCurrentMutation:async target=>Object.freeze({
    domain:MOVIE_MENTOR_CREATOR_STATE_MUTATION_PROOF_DOMAIN,
    schema:MOVIE_MENTOR_CREATOR_STATE_MUTATION_SCHEMA,
    authorized:true,currentOwnershipVerified:true,principalId:"creator-345",projectId,
    ownershipRef:"ownership-345",ownershipRevision:1,...target
  })
});

function nextState(barrier=0){
  return {
    ...legacy,revision:9,revisionAuthorityReference:"revision-9",
    snapshotReference:"snapshot-9",creatorStateGeneration:9,
    creatorStateFingerprint:"c".repeat(64),creatorAuthorityReference:"creator-9",
    compensationBarrierRevision:barrier,capturedAt:new Date().toISOString(),
    transition:{source:"creator-memory"}
  };
}
function compensationFilter(){
  return {
    projectId,revision:8,revisionAuthorityReference:"revision-8",snapshotReference:"snapshot-8",
    creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64),creatorAuthorityReference:"creator-8"
  };
}

const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri,"physical court requires MONGO_URI");
await mongoose.connect(uri);
const collection=mongoose.connection.db.collection("movie_mentor_creator_state");
await collection.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});

async function resetLegacy(){
  await collection.deleteMany({projectId});
  await collection.insertOne(structuredClone(legacy));
  const physical=await collection.findOne({projectId});
  assert.equal(Object.hasOwn(physical,"compensationBarrierRevision"),false,"Mongo fixture must remain physically missing");
}
async function transition(){
  try {
    const value=await writeAuthoritativeCreatorState(nextState(0),{expectedRevision:8,creatorStateMutationAuthority:authority});
    return {won:true,value};
  } catch(error) {
    if(error?.code==="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT")return {won:false,error};
    throw error;
  }
}
async function compensation(){
  const result=await collection.updateOne(compensationFilter(),{$inc:{compensationBarrierRevision:1}});
  return {won:result.matchedCount===1,result};
}

for(let i=0;i<40;i++){
  await resetLegacy();
  const [creator,comp]=await Promise.all([transition(),compensation()]);
  assert.notEqual(creator.won,comp.won,"exactly one competing first materializer must win");
  const row=await collection.findOne({projectId});
  if(creator.won){
    assert.equal(row.revision,9);
    assert.equal(row.compensationBarrierRevision,0);
    assert.equal((await collection.updateOne(compensationFilter(),{$inc:{compensationBarrierRevision:1}})).matchedCount,0,
      "old-universe compensation must remain rejected after Creator transition wins");
  }else{
    assert.equal(row.revision,8);
    assert.equal(row.compensationBarrierRevision,1);
    await assert.rejects(
      ()=>writeAuthoritativeCreatorState(nextState(0),{expectedRevision:8,creatorStateMutationAuthority:authority}),
      e=>e?.code==="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT",
      "stale logical-zero transition must remain rejected after compensation materializes one"
    );
    const retry=await writeAuthoritativeCreatorState(nextState(1),{expectedRevision:8,creatorStateMutationAuthority:authority});
    assert.equal(retry.revision,9);
    assert.equal(retry.compensationBarrierRevision,1);
  }
}

// A separate irreversible result-candidate barrier may physically materialize while
// compensationBarrierRevision is still missing. It must not destroy that missing
// representation before the first compensation/transition race.
await resetLegacy();
const candidateBarrier=await collection.updateOne(
  {projectId,revision:8,creatorStateGeneration:8,creatorStateFingerprint:"b".repeat(64)},
  {$inc:{resultCandidateBarrierRevision:1}}
);
assert.equal(candidateBarrier.matchedCount,1,"adjacent candidate barrier must touch the exact legacy Creator universe");
let adjacent=await collection.findOne({projectId});
assert.equal(adjacent.resultCandidateBarrierRevision,1);
assert.equal(Object.hasOwn(adjacent,"compensationBarrierRevision"),false,
  "independent barrier materialization must preserve the physically missing compensation barrier");
const compensationAfterAdjacent=await collection.updateOne(compensationFilter(),{$inc:{compensationBarrierRevision:1}});
assert.equal(compensationAfterAdjacent.matchedCount,1,
  "first compensation must still materialize missing→1 after an unrelated Creator-state barrier touch");
adjacent=await collection.findOne({projectId});
assert.equal(adjacent.compensationBarrierRevision,1);
assert.equal(adjacent.resultCandidateBarrierRevision,1);

const store=fs.readFileSync(new URL("../ai/MovieMentorCreatorStateStore.js",import.meta.url),"utf8");
const settlement=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
assert.match(store,/doc\.compensationBarrierRevision===0\?\{\$or:\[\{compensationBarrierRevision:0\},\{compensationBarrierRevision:\{\$exists:false\}\}\]\}:\{compensationBarrierRevision:doc\.compensationBarrierRevision\}/,
  "Creator CAS must admit missing only for logical zero");
assert.match(settlement,/creatorStates\.updateOne\(\{projectId:text\(execution\.projectId\),revision:durableCurrentUniverse\.revision,[\s\S]*?creatorAuthorityReference:text\(durableCurrentUniverse\.creatorStateAuthorityReference\)\},\{\$inc:\{compensationBarrierRevision:1\}\},\{session\}\)/,
  "compensation must atomically increment the exact Creator-state universe inside its transaction");

await mongoose.disconnect();
console.log("GREEN: real Mongo physical races permit exactly one first materializer; the stale loser is rejected and barrier-one retry is exact.");
console.log("LAW: MISSING MAY REPRESENT ZERO ONLY UNTIL THE FIRST ATOMIC MONGO WRITER MATERIALIZES ZERO OR ONE; AFTER THAT, CURRENT PHYSICAL AUTHORITY DECIDES.");
