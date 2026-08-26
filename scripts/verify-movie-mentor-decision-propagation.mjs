import assert from "node:assert/strict";
import { classifyCreatorTruth, buildCurrentCreatorTruthView, assertCurrentCreatorTruthOnly } from "../ai/MovieMentorCreatorTruthViewControl.js";
import { buildTurnEnvelopeFromDurableState } from "../ai/MovieMentorTurnRuntime.js";
import { validateWorkOrder } from "../ai/MovieMentorSpecialistExecutor.js";
import { validateSynthesisRequest } from "../ai/MovieMentorSynthesisEngine.js";

const oldDecision={key:"creatorDecision.semantic.story.route",value:"hidden tunnel",authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.story.route",decisionId:"d-old",decisionFingerprint:"a".repeat(64),current:false,supersededByDecisionId:"d-new"};
const currentDecision={key:"creatorDecision.semantic.story.route",value:"lighthouse",authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.story.route",decisionId:"d-new",decisionFingerprint:"b".repeat(64),current:true};
const legacyTruth={key:"movie.genre",value:"thriller",authority:"creator",confidenceSource:"creator-confirmed"};
const malformedDecision={key:"creatorDecision.semantic.story.villain",value:"Zod",authority:"creator",confidenceSource:"creator-confirmed",decisionKey:"semantic.story.villain",decisionId:"d-bad"};
const classified=classifyCreatorTruth([oldDecision,currentDecision,legacyTruth,malformedDecision]);
assert.deepEqual(classified.active.map(x=>x.value),["lighthouse","thriller"]);
assert.equal(classified.historical.length,1);assert.equal(classified.historical[0].value,"hidden tunnel");assert.equal(classified.rejected.length,1);
const active=buildCurrentCreatorTruthView([oldDecision,currentDecision,legacyTruth]);assert.equal(active.some(x=>x.value==="hidden tunnel"),false);assert.equal(active.some(x=>x.value==="lighthouse"),true);
assert.throws(()=>assertCurrentCreatorTruthOnly([oldDecision]),e=>e.code==="MOVIE_MENTOR_SUPERSEDED_CREATOR_TRUTH_FORBIDDEN");

const state={projectId:"p1",creatorSessionId:"s2",revision:9,revisionAuthorityReference:"rev-9",creatorStateGeneration:5,creatorStateFingerprint:"state-5",creatorAuthorityReference:"auth-5",snapshotReference:"snap-9",capturedAt:new Date().toISOString(),creatorConfirmedContext:[oldDecision,currentDecision,legacyTruth],projectJourney:{stageId:"story"},memoryContext:null,responseBlueprint:null,communicationPlan:null};
const envelope=buildTurnEnvelopeFromDurableState({creatorMessage:"Carry on.",state});
assert.equal(envelope.creatorConfirmedContext.some(x=>x.value==="hidden tunnel"),false,"superseded Codex must not enter next turn");
assert.equal(envelope.creatorConfirmedContext.some(x=>x.value==="lighthouse"),true,"current Codex must enter next turn");

const workOrder={agentId:"story",authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,input:{creatorConfirmedContext:[oldDecision]}};
assert.equal(validateWorkOrder(workOrder).valid,false,"Story boundary must reject a resurrected superseded decision");
assert.equal(validateWorkOrder({...workOrder,input:{creatorConfirmedContext:[currentDecision]}}).valid,true,"Story boundary must accept current decision");

const synthesisBase={creatorMessage:"Continue",semanticIntelligence:{clarificationNeeded:[]},contributions:[]};
assert.equal(validateSynthesisRequest({...synthesisBase,creatorConfirmedContext:[oldDecision]}).valid,false,"Synthesis must reject superseded creator truth");
assert.equal(validateSynthesisRequest({...synthesisBase,creatorConfirmedContext:[currentDecision]}).valid,true,"Synthesis must accept current creator truth");

console.log("Movie Mentor decision consequence propagation verification: PASS — current creator truth propagates; superseded Codex remains history only.");
