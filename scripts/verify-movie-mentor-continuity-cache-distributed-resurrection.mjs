import assert from "node:assert/strict";
import { createDerivedContinuityConstraint } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createContinuityDerivedCacheRecord } from "../ai/MovieMentorContinuityDerivedCacheControl.js";
import { buildContinuityCacheAtomicWriteFilter, writeContinuityDerivedCache } from "../ai/MovieMentorContinuityDerivedCacheStore.js";

const truth=(age,id,fingerprint)=>[
 {key:"creatorDecision.semantic.character.mayaAge",value:age,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.character.mayaAge",decisionId:id,decisionFingerprint:fingerprint,current:true},
 {key:"creatorDecision.semantic.timeline.jump",value:10,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.timeline.jump",decisionId:"jump-10",decisionFingerprint:"b".repeat(64),current:true},
];
const truthA=truth(17,"age-17","a".repeat(64));
const truthB=truth(19,"age-19","c".repeat(64));
const truthC=truth(21,"age-21","f".repeat(64));
const stateA={projectId:"movie-1",revision:9,creatorStateGeneration:5,creatorStateFingerprint:"d".repeat(64),snapshotReference:"snap-9"};
const stateB={projectId:"movie-1",revision:10,creatorStateGeneration:6,creatorStateFingerprint:"e".repeat(64),snapshotReference:"snap-10"};
const stateC={projectId:"movie-1",revision:11,creatorStateGeneration:7,creatorStateFingerprint:"1".repeat(64),snapshotReference:"snap-11"};

function constraintFor(stateTruth,value){return createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.current",value,reason:"Age after the creator-confirmed ten-year jump.",confidence:1,dependencies:[{key:stateTruth[0].key,value:stateTruth[0].value},{key:stateTruth[1].key,value:10}]},stateTruth);}
function recordFor(state,stateTruth,value){return createContinuityDerivedCacheRecord({sourceState:state,creatorConfirmedContext:stateTruth,constraints:[constraintFor(stateTruth,value)]});}
const recordA=recordFor(stateA,truthA,27),recordB=recordFor(stateB,truthB,29),recordC=recordFor(stateC,truthC,31);

const filterB=buildContinuityCacheAtomicWriteFilter(recordB);
assert.equal(filterB.projectHeadKey,"movie-1");
assert.deepEqual(filterB.$or[0],{sourceRevision:{$lt:10}},"newer revision must atomically supersede an older project cache head");
assert.deepEqual(filterB.$or[2],{sourceRevision:10,sourceCreatorStateGeneration:6,sourceCreatorStateFingerprint:stateB.creatorStateFingerprint,sourceSnapshotReference:"snap-10"},"same-authority retries may be idempotent only for the exact authority identity");

function createAtomicProjectHeadModel(){
 let head=null;
 const clone=v=>v==null?v:structuredClone(v);
 function matches(filter,current){
  if(!current||current.projectHeadKey!==filter.projectHeadKey)return false;
  return filter.$or.some(branch=>{
   if(branch.sourceRevision?.$lt!==undefined)return current.sourceRevision<branch.sourceRevision.$lt;
   if(branch.sourceCreatorStateGeneration?.$lt!==undefined)return current.sourceRevision===branch.sourceRevision&&current.sourceCreatorStateGeneration<branch.sourceCreatorStateGeneration.$lt;
   return current.sourceRevision===branch.sourceRevision&&current.sourceCreatorStateGeneration===branch.sourceCreatorStateGeneration&&current.sourceCreatorStateFingerprint===branch.sourceCreatorStateFingerprint&&current.sourceSnapshotReference===branch.sourceSnapshotReference;
  });
 }
 return{
  snapshot(){return clone(head);},
  findOneAndUpdate(filter,update,options){
   return{
    lean(){
     return{
      async exec(){
       if(!head){head=clone(update.$set);return clone(head);}
       if(matches(filter,head)){head=clone(update.$set);return clone(head);}
       if(options?.upsert){const error=new Error("duplicate project head");error.code=11000;throw error;}
       return null;
      },
     };
    },
   };
  },
 };
}

const model=createAtomicProjectHeadModel();
const creatorAuthorityBeforeB=structuredClone(stateB);
await writeContinuityDerivedCache(recordB,stateB,truthB,{model});
assert.deepEqual(stateB,creatorAuthorityBeforeB,"cache persistence must not mutate creator authority inputs");
assert.equal(model.snapshot().sourceRevision,10);
assert.equal(model.snapshot().constraints[0].value,29);

await assert.rejects(
 ()=>writeContinuityDerivedCache(recordA,stateA,truthA,{model}),
 error=>error?.code==="MOVIE_MENTOR_CONTINUITY_CACHE_STALE_RESURRECTION_DENIED",
 "late old-authority process must not resurrect A after B has become the durable project cache head",
);
assert.equal(model.snapshot().sourceRevision,10,"rejected A must not displace B");
assert.equal(model.snapshot().constraints[0].value,29);

for(const worker of ["A1","A2"]){
 await assert.rejects(
  ()=>writeContinuityDerivedCache(structuredClone(recordA),structuredClone(stateA),structuredClone(truthA),{model}),
  error=>error?.code==="MOVIE_MENTOR_CONTINUITY_CACHE_STALE_RESURRECTION_DENIED",
  `${worker} must lose the distributed stale-resurrection fence`,
 );
}
assert.equal(model.snapshot().sourceCreatorStateFingerprint,stateB.creatorStateFingerprint);

await writeContinuityDerivedCache(structuredClone(recordB),structuredClone(stateB),structuredClone(truthB),{model});
const forgedSameOrdinal={...structuredClone(recordB),sourceCreatorStateFingerprint:"9".repeat(64),sourceSnapshotReference:"forged-snap"};
await assert.rejects(
 ()=>writeContinuityDerivedCache(forgedSameOrdinal,{...stateB,creatorStateFingerprint:"9".repeat(64),snapshotReference:"forged-snap"},truthB,{model}),
 error=>error?.code==="MOVIE_MENTOR_CONTINUITY_CACHE_STALE_RESURRECTION_DENIED",
 "same revision/generation with a different authority fingerprint must not replace the project head",
);

await writeContinuityDerivedCache(recordC,stateC,truthC,{model});
assert.equal(model.snapshot().sourceRevision,11);
assert.equal(model.snapshot().sourceCreatorStateGeneration,7);
assert.equal(model.snapshot().sourceCreatorStateFingerprint,stateC.creatorStateFingerprint);
assert.equal(model.snapshot().constraints[0].value,31);

await assert.rejects(
 ()=>writeContinuityDerivedCache(recordB,stateB,truthB,{model}),
 error=>error?.code==="MOVIE_MENTOR_CONTINUITY_CACHE_STALE_RESURRECTION_DENIED",
 "former authority B must become non-resurrectable after C advances the project head",
);
assert.equal(model.snapshot().sourceRevision,11);
assert.equal(model.snapshot().constraints[0].value,31);

console.log("Movie Mentor distributed continuity cache resurrection torture: GREEN — one monotonic project cache head fences delayed old-authority writers, exact retries remain idempotent, and only newer creator authority can advance durable derived reality.");
