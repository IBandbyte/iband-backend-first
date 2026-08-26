import assert from "node:assert/strict";
import { createDerivedContinuityConstraint } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createContinuityDerivedCacheRecord, validateContinuityDerivedCacheRecord } from "../ai/MovieMentorContinuityDerivedCacheControl.js";
import { getMovieMentorContinuityDerivedCacheStoreStatus } from "../ai/MovieMentorContinuityDerivedCacheStore.js";
import { executeContinuityWorkOrder } from "../ai/MovieMentorSpecialistExecutor.js";

const truthA=[
 {key:"creatorDecision.semantic.character.mayaAge",value:17,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.character.mayaAge",decisionId:"age-17",decisionFingerprint:"a".repeat(64),current:true},
 {key:"creatorDecision.semantic.timeline.jump",value:10,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.timeline.jump",decisionId:"jump-10",decisionFingerprint:"b".repeat(64),current:true},
];
const truthB=[
 {...truthA[0],value:19,decisionId:"age-19",decisionFingerprint:"c".repeat(64)},
 truthA[1],
];
const stateA={projectId:"movie-1",revision:9,creatorStateGeneration:5,creatorStateFingerprint:"d".repeat(64),snapshotReference:"snap-9",creatorConfirmedContext:truthA};
const stateB={projectId:"movie-1",revision:10,creatorStateGeneration:6,creatorStateFingerprint:"e".repeat(64),snapshotReference:"snap-10",creatorConfirmedContext:truthB};
const authorityFrom=state=>({snapshotFingerprint:"f".repeat(64),snapshotReference:state.snapshotReference,revision:state.revision,revisionAuthorityReference:`rev-${state.revision}`,creatorState:{generation:state.creatorStateGeneration,fingerprint:state.creatorStateFingerprint,authorityReference:`creator-${state.creatorStateGeneration}`}});
const workOrderFrom=(state,truth,message="Carry on.")=>({agentId:"continuity",purpose:"continuity",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,mayCreateCanon:false,authority:"mentor-provisional",input:{projectId:state.projectId,creatorMessage:message,semanticIntelligence:{readyToAdvance:true},currentCreatorTruth:truth,projectJourney:{stageId:"story"},memoryContext:{},turnContextAuthority:authorityFrom(state)}});
const age27=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.current",value:27,reason:"Maya was 17 before the ten-year jump.",confidence:1,dependencies:[{key:truthA[0].key,value:17},{key:truthA[1].key,value:10}]},truthA);
const age29=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.current",value:29,reason:"Maya was 19 before the ten-year jump.",confidence:1,dependencies:[{key:truthB[0].key,value:19},{key:truthB[1].key,value:10}]},truthB);

const status=getMovieMentorContinuityDerivedCacheStoreStatus();
assert.equal(status.collection,"movie_mentor_continuity_derived_cache","restart torture must target the existing dedicated durable cache store contract");
assert.equal(status.canonical,false);assert.equal(status.mutatesCreatorState,false);

// External durable surface: survives fresh executor/dependency instances just as Mongo survives process death.
const durableRecords=new Map();
function durableReadAdapter(){return async(currentState,currentTruth)=>{
 const key=`${currentState.projectId}:${currentState.creatorStateFingerprint}`;
 const raw=durableRecords.get(key);
 if(!raw)return{hit:false,stale:false,constraints:[],record:null};
 const validation=validateContinuityDerivedCacheRecord(structuredClone(raw),currentState,currentTruth);
 return validation.valid?{hit:true,stale:false,constraints:validation.constraints,record:structuredClone(raw)}:{hit:false,stale:true,constraints:[],record:null,reasons:validation.reasons};
};}
function durableWriteAdapter({failBeforeAck=false}={}){return async(record,currentState,currentTruth)=>{
 if(failBeforeAck){const error=new Error("simulated crash before durable write ACK");error.code="SIMULATED_CRASH_BEFORE_CACHE_ACK";throw error;}
 const validation=validateContinuityDerivedCacheRecord(record,currentState,currentTruth);
 if(!validation.valid){const error=new Error("stale cache write denied");error.code="MOVIE_MENTOR_CONTINUITY_CACHE_RECORD_STALE";error.reasons=validation.reasons;throw error;}
 durableRecords.set(record.cacheKey,structuredClone(record));
 return structuredClone(record);
};}

let authoritativeState=structuredClone(stateA);
const authorityBefore=structuredClone(authoritativeState);
let firstSawReusable=null;
const first=await executeContinuityWorkOrder(workOrderFrom(stateA,truthA),{
 readReusableContinuityDerivedCache:durableReadAdapter(),
 readAuthoritativeTurnSource:async()=>structuredClone(authoritativeState),
 executeContinuityAgent:async work=>{firstSawReusable=structuredClone(work.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[age27]},metadata:{process:"A"}};},
 writeContinuityDerivedCache:durableWriteAdapter(),
});
assert.deepEqual(firstSawReusable,[],"first process must derive fresh continuity on durable cache miss");
assert.equal(first.metadata.continuityCache.write.status,"written","durable cache write must be acknowledged before restart reuse is claimed");
assert.deepEqual(authoritativeState,authorityBefore,"cache write must not mutate creator revision/generation/fingerprint/snapshot authority");
assert.equal(durableRecords.size,1,"ACKed derived cache must exist outside process-local execution state");

// Simulated process death: no reused in-process objects or executor metadata, only the durable record survives.
let restartedSawReusable=null;
const restartDeps={
 readReusableContinuityDerivedCache:durableReadAdapter(),
 readAuthoritativeTurnSource:async()=>structuredClone(authoritativeState),
 executeContinuityAgent:async work=>{restartedSawReusable=structuredClone(work.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[]},metadata:{process:"B"}};},
 writeContinuityDerivedCache:durableWriteAdapter(),
};
const restarted=await executeContinuityWorkOrder(workOrderFrom(stateA,truthA,"Continue after restart."),restartDeps);
assert.equal(restarted.metadata.continuityCache.read.hit,true,"fresh execution boundary must recover ACKed derived continuity from durable storage");
assert.equal(restartedSawReusable.length,1,"restarted Continuity must receive durable reusable constraint before inference");
assert.equal(restartedSawReusable[0].constraintId,age27.constraintId);
assert.equal(restartedSawReusable[0].creatorConfirmed,false);assert.equal(restartedSawReusable[0].mayCreateCanon,false);
assert.deepEqual(authoritativeState,authorityBefore,"restart cache read/write must leave creator authority bit-for-bit unchanged");

// Crash before ACK: failed write cannot become fake durable persistence.
const beforeCrashCount=durableRecords.size;
const noCacheProjectState={...stateA,projectId:"movie-crash",creatorStateFingerprint:"1".repeat(64),snapshotReference:"crash-snap"};
const noCacheTruth=structuredClone(truthA);
const crashConstraint=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.current",value:27,reason:"Fresh crash-path derivation.",confidence:1,dependencies:[{key:noCacheTruth[0].key,value:17},{key:noCacheTruth[1].key,value:10}]},noCacheTruth);
let crashAuthority=structuredClone(noCacheProjectState);
const crashed=await executeContinuityWorkOrder(workOrderFrom(noCacheProjectState,noCacheTruth,"Crash path."),{
 readReusableContinuityDerivedCache:durableReadAdapter(),
 readAuthoritativeTurnSource:async()=>structuredClone(crashAuthority),
 executeContinuityAgent:async()=>({success:true,contribution:{agentId:"continuity",derivedConstraints:[crashConstraint]},metadata:{}}),
 writeContinuityDerivedCache:durableWriteAdapter({failBeforeAck:true}),
});
assert.equal(crashed.metadata.continuityCache.write.status,"not-written");
assert.equal(crashed.metadata.continuityCache.write.reason,"SIMULATED_CRASH_BEFORE_CACHE_ACK");
assert.equal(durableRecords.size,beforeCrashCount,"pre-ACK crash must leave no new durable cache record");
let postCrashReusable="unset";
await executeContinuityWorkOrder(workOrderFrom(noCacheProjectState,noCacheTruth,"Restart after crash."),{
 readReusableContinuityDerivedCache:durableReadAdapter(),
 readAuthoritativeTurnSource:async()=>structuredClone(crashAuthority),
 executeContinuityAgent:async work=>{postCrashReusable=structuredClone(work.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[]},metadata:{}};},
 writeContinuityDerivedCache:durableWriteAdapter(),
});
assert.deepEqual(postCrashReusable,[],"restart after pre-ACK crash must not hallucinate persistence");

// The decisive race: creator corrects truth while Continuity is reasoning under frozen authority A.
authoritativeState=structuredClone(stateA);
let raceWriteCalls=0;
const raced=await executeContinuityWorkOrder(workOrderFrom(stateA,truthA,"Actually keep working."),{
 readReusableContinuityDerivedCache:durableReadAdapter(),
 readAuthoritativeTurnSource:async()=>structuredClone(authoritativeState),
 executeContinuityAgent:async()=>{
  authoritativeState=structuredClone(stateB); // authorised creator correction lands while inference is in flight
  return{success:true,contribution:{agentId:"continuity",derivedConstraints:[age27]},metadata:{race:true}};
 },
 writeContinuityDerivedCache:async(...args)=>{raceWriteCalls+=1;return durableWriteAdapter()(...args);},
});
assert.equal(raced.metadata.continuityCache.write.status,"not-written","late creator correction must deny old-authority cache persistence");
assert.equal(raced.metadata.continuityCache.write.reason,"continuity_cache_creator_authority_changed_during_inference");
assert.equal(raceWriteCalls,0,"stale derived result must be killed before Mongo write is attempted");
assert.equal(authoritativeState.revision,10);assert.equal(authoritativeState.creatorStateGeneration,6);assert.equal(authoritativeState.creatorStateFingerprint,stateB.creatorStateFingerprint);assert.equal(authoritativeState.snapshotReference,stateB.snapshotReference);

// New turn under authority B cannot see the old A cache and derives the corrected consequence instead.
let correctedSawReusable=null,correctedWritten=null;
const corrected=await executeContinuityWorkOrder(workOrderFrom(stateB,truthB,"Continue with Maya at nineteen."),{
 readReusableContinuityDerivedCache:durableReadAdapter(),
 readAuthoritativeTurnSource:async()=>structuredClone(authoritativeState),
 executeContinuityAgent:async work=>{correctedSawReusable=structuredClone(work.input.reusableDerivedContinuity);return{success:true,contribution:{agentId:"continuity",derivedConstraints:[age29]},metadata:{}};},
 writeContinuityDerivedCache:async(record,...rest)=>{correctedWritten=structuredClone(record);return durableWriteAdapter()(record,...rest);},
});
assert.deepEqual(correctedSawReusable,[],"creator correction must make old fingerprint cache invisible on the next turn");
assert.equal(corrected.metadata.continuityCache.read.hit,false);
assert.equal(corrected.metadata.continuityCache.write.status,"written");
assert.equal(correctedWritten.constraints[0].value,29,"fresh derivation under corrected creator truth must win");
assert.equal(correctedWritten.sourceRevision,10);assert.equal(correctedWritten.sourceCreatorStateGeneration,6);assert.equal(correctedWritten.sourceCreatorStateFingerprint,stateB.creatorStateFingerprint);

console.log("Movie Mentor continuity cache restart/reload catastrophe torture: GREEN — ACKed derived knowledge survives restart, pre-ACK crashes never fake persistence, concurrent creator correction kills stale writes before Mongo, and cache activity never mutates creator authority.");
