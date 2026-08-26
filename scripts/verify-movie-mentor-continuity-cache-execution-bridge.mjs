import assert from "node:assert/strict";
import { createDerivedContinuityConstraint } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createContinuityWorkOrder } from "../ai/MovieMentorContinuityAgent.js";
import { continuityAuthorityState,executeContinuityWorkOrder } from "../ai/MovieMentorSpecialistExecutor.js";

const truth=[
 {key:"creatorDecision.semantic.character.mayaAge",value:17,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.character.mayaAge",decisionId:"age-17",decisionFingerprint:"a".repeat(64),current:true},
 {key:"creatorDecision.semantic.timeline.jump",value:10,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.timeline.jump",decisionId:"jump-10",decisionFingerprint:"b".repeat(64),current:true},
 {key:"creatorDecision.semantic.location.tunnel",value:"hidden tunnel",authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.location.tunnel",decisionId:"tunnel-1",decisionFingerprint:"c".repeat(64),current:true},
];
const cachedAge=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.current",value:27,reason:"Maya was 17 before the ten-year jump.",confidence:1,dependencies:[{key:truth[0].key,value:17},{key:truth[1].key,value:10}]},truth);
const freshTunnel=createDerivedContinuityConstraint({category:"location",key:"story.route.current",value:"hidden tunnel",reason:"The creator confirmed the hidden tunnel route.",confidence:1,dependencies:[{key:truth[2].key,value:"hidden tunnel"}]},truth);
const authority={snapshotFingerprint:"d".repeat(64),snapshotReference:"snap-9",revision:9,revisionAuthorityReference:"rev-9",creatorState:{generation:5,fingerprint:"e".repeat(64),authorityReference:"creator-5"}};
const workOrder={agentId:"continuity",purpose:"continuity",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,mayCreateCanon:false,authority:"mentor-provisional",input:{projectId:"movie-1",creatorMessage:"Carry on.",semanticIntelligence:{readyToAdvance:true},currentCreatorTruth:truth,projectJourney:{stageId:"story"},memoryContext:{},turnContextAuthority:authority}};

assert.deepEqual(continuityAuthorityState(workOrder.input),{projectId:"movie-1",revision:9,creatorStateGeneration:5,creatorStateFingerprint:"e".repeat(64),snapshotReference:"snap-9"},"bridge must reconstruct cache authority only from frozen turn authority plus canonical project id");

let agentSawReusable=null,writtenRecord=null,readCount=0,writeCount=0;
const result=await executeContinuityWorkOrder(workOrder,{
 readReusableContinuityDerivedCache:async()=>{readCount+=1;return{hit:true,stale:false,constraints:[cachedAge],record:{cacheKey:"movie-1:"+"e".repeat(64)}};},
 executeContinuityAgent:async w=>{agentSawReusable=structuredClone(w.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[freshTunnel]},metadata:{fake:true}};},
 writeContinuityDerivedCache:async record=>{writeCount+=1;writtenRecord=structuredClone(record);return record;},
});
assert.equal(readCount,1,"live Continuity execution must perform one authority-bound cache read");
assert.equal(writeCount,1,"validated derived constraints must be persisted after Continuity execution");
assert.equal(agentSawReusable.length,1,"cache HIT must enter Continuity before provider inference");
assert.equal(agentSawReusable[0].constraintId,cachedAge.constraintId);
assert.equal(writtenRecord.constraints.length,2,"cache write must retain reusable constraints and add newly derived constraints");
assert.equal(writtenRecord.creatorConfirmed,false);assert.equal(writtenRecord.mayCreateCanon,false);
assert.equal(result.metadata.continuityCache.creatorStateMutation,false,"cache bridge must never claim creator-state mutation");
assert.equal(result.metadata.continuityCache.canonical,false,"cache bridge must remain non-canonical");

agentSawReusable=null;writeCount=0;
await executeContinuityWorkOrder(workOrder,{
 readReusableContinuityDerivedCache:async()=>({hit:false,stale:true,constraints:[],record:null,reasons:["continuity_cache_source_fingerprint_stale"]}),
 executeContinuityAgent:async w=>{agentSawReusable=structuredClone(w.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[freshTunnel]},metadata:{}};},
 writeContinuityDerivedCache:async()=>{writeCount+=1;},
});
assert.deepEqual(agentSawReusable,[],"stale cache must become invisible to Continuity");
assert.equal(writeCount,1,"stale cache may be replaced only by freshly validated derived output");

agentSawReusable=null;
const degraded=await executeContinuityWorkOrder(workOrder,{
 readReusableContinuityDerivedCache:async()=>{const e=new Error("Mongo unavailable");e.code="CACHE_DOWN";throw e;},
 executeContinuityAgent:async w=>{agentSawReusable=structuredClone(w.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[freshTunnel]},metadata:{}};},
 writeContinuityDerivedCache:async()=>{const e=new Error("write unavailable");e.code="CACHE_WRITE_DOWN";throw e;},
});
assert.deepEqual(agentSawReusable,[],"cache availability failure must degrade to inference without derived cache authority");
assert.equal(degraded.metadata.continuityCache.write.status,"not-written","cache write failure must not fake persistence");
assert.equal(degraded.metadata.continuityCache.write.reason,"CACHE_WRITE_DOWN");

const tampered={...structuredClone(cachedAge),value:99};
assert.throws(()=>createContinuityWorkOrder({creatorMessage:"x",currentCreatorTruth:truth,reusableDerivedContinuity:[tampered]}),error=>error?.code==="CONTINUITY_REUSABLE_DERIVED_INVALID","tampered reusable constraints must be rejected before model inference");

let bypassRead=0,bypassWrite=0;
const noProject={...structuredClone(workOrder),input:{...structuredClone(workOrder.input),projectId:null}};
const bypass=await executeContinuityWorkOrder(noProject,{
 readReusableContinuityDerivedCache:async()=>{bypassRead+=1;return{hit:true,constraints:[cachedAge]};},
 executeContinuityAgent:async w=>({success:true,contribution:{agentId:"continuity",derivedConstraints:[]},metadata:{reusableCount:w.input.reusableDerivedContinuity.length}}),
 writeContinuityDerivedCache:async()=>{bypassWrite+=1;},
});
assert.equal(bypassRead,0,"missing canonical project identity must bypass cache read rather than invent identity");
assert.equal(bypassWrite,0,"missing canonical project identity must bypass cache write");
assert.equal(bypass.metadata.continuityCache.read.constraintCount,0);

console.log("Movie Mentor cache-aware Continuity execution bridge torture: GREEN — cache is snapshot-bound derived context, stale/tampered data stays invisible, and creator authority is never mutated.");
