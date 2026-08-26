import assert from "node:assert/strict";
import { createDerivedContinuityConstraint } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createContinuityDerivedCacheRecord,validateContinuityDerivedCacheRecord,selectReusableContinuityConstraints } from "../ai/MovieMentorContinuityDerivedCacheControl.js";

const truth=[{key:"creatorDecision.semantic.character.mayaAge",value:17,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.character.mayaAge",decisionId:"age-17",decisionFingerprint:"a".repeat(64),current:true},{key:"creatorDecision.semantic.timeline.jump",value:10,authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.timeline.jump",decisionId:"jump-10",decisionFingerprint:"b".repeat(64),current:true}];
const state={projectId:"movie-1",revision:9,creatorStateGeneration:5,creatorStateFingerprint:"c".repeat(64),snapshotReference:"snap-9"};
const age27=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.current",value:27,reason:"Maya was 17 before the creator-confirmed ten-year jump.",confidence:1,dependencies:[{key:truth[0].key,value:17},{key:truth[1].key,value:10}]},truth);
const cache=createContinuityDerivedCacheRecord({sourceState:state,creatorConfirmedContext:truth,constraints:[age27]});
let result=validateContinuityDerivedCacheRecord(cache,state,truth);assert.equal(result.valid,true,"unchanged creator authority must allow exact derived-cache reuse");assert.equal(selectReusableContinuityConstraints(cache,state,truth)[0].value,27);
assert.equal(cache.creatorConfirmed,false);assert.equal(cache.mayCreateCanon,false);assert.equal(cache.authority,"derived-continuity-cache");

const changedTruth=[{...truth[0],value:19,decisionId:"age-19",decisionFingerprint:"d".repeat(64)},truth[1]];
const changedState={...state,revision:10,creatorStateGeneration:6,creatorStateFingerprint:"e".repeat(64),snapshotReference:"snap-10"};
result=validateContinuityDerivedCacheRecord(cache,changedState,changedTruth);assert.equal(result.valid,false,"creator change must invalidate old derived cache");assert.equal(result.stale,true);assert.deepEqual(selectReusableContinuityConstraints(cache,changedState,changedTruth),[]);

const sameTruthNewRevision={...state,revision:10,creatorStateGeneration:6,creatorStateFingerprint:"f".repeat(64),snapshotReference:"snap-10"};
result=validateContinuityDerivedCacheRecord(cache,sameTruthNewRevision,truth);assert.equal(result.valid,false,"cache is bound to one authoritative creator-state snapshot even when relevant truth values look unchanged");

result=validateContinuityDerivedCacheRecord(cache,{...state,projectId:"movie-2"},truth);assert.equal(result.valid,false,"cross-project derived cache reuse must fail");assert.equal(result.reasons.includes("continuity_cache_project_mismatch"),true);

const tampered={...structuredClone(cache),constraints:structuredClone(cache.constraints)};tampered.constraints[0].value=99;result=validateContinuityDerivedCacheRecord(tampered,state,truth);assert.equal(result.valid,false,"tampered derived value must fail validation");

const superseded=[{...truth[0],current:false},truth[1]];result=validateContinuityDerivedCacheRecord(cache,state,superseded);assert.equal(result.valid,false,"superseded creator decision can never support cache reuse");

console.log("Movie Mentor continuity derived-cache authority torture: GREEN — reuse is snapshot-bound, non-canonical and stale dependencies fail closed.");
