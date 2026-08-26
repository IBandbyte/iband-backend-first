import assert from "node:assert/strict";
import { buildSpecialistPlan, continuityClarificationResponse, LIVE_SPECIALIST_ORDER } from "../ai/MovieMentorTurnOrchestrator.js";
import { validateWorkOrder, LIVE_AGENT_IDS } from "../ai/MovieMentorSpecialistExecutor.js";
import { createDerivedContinuityConstraint, buildContinuityConsequenceEnvelope } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { validateSynthesisRequest } from "../ai/MovieMentorSynthesisEngine.js";

const currentTruth=[
 {key:"creatorDecision.character.maya.age",value:"17",authority:"creator",confidenceSource:"creator-confirmed",decisionId:"d-age",decisionKey:"character.maya.age",decisionFingerprint:"a".repeat(64),current:true},
 {key:"creatorDecision.timeline.jump",value:"10 years",authority:"creator",confidenceSource:"creator-confirmed",decisionId:"d-jump",decisionKey:"timeline.jump",decisionFingerprint:"b".repeat(64),current:true}
];
const plan=buildSpecialistPlan({creatorMessage:"Continue ten years later.",semanticIntelligence:{recommendedStageId:"story",recommendedTaskId:"timeline"},creatorConfirmedContext:currentTruth,context:{projectJourney:{stageId:"story"},memoryContext:{}},continuationObedienceEnvelope:{references:[],requiredReferenceIds:[]}});
assert.deepEqual(LIVE_SPECIALIST_ORDER,["story","character","continuity"]);
assert.equal(LIVE_AGENT_IDS.has("continuity"),true);
assert.equal(plan.workOrders.length,3);
const continuityOrder=plan.workOrders.find(x=>x.agentId==="continuity");
assert.ok(continuityOrder);
assert.deepEqual(continuityOrder.input.currentCreatorTruth,currentTruth);
assert.equal(Object.hasOwn(continuityOrder.input,"creatorConfirmedContext"),false);
assert.equal(continuityOrder.mayCreateCanon,false);
assert.equal(validateWorkOrder(continuityOrder).valid,true);
const stale={...currentTruth[0],current:false};
const staleOrder={...continuityOrder,input:{...continuityOrder.input,currentCreatorTruth:[stale]}};
assert.equal(validateWorkOrder(staleOrder).valid,false,"superseded Codex must never enter live Continuity");

const age27=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.after.jump",value:"27",reason:"Maya is 17 and ten years pass.",confidence:1,dependencies:[{key:currentTruth[0].key,value:"17"},{key:currentTruth[1].key,value:"10 years"}]},currentTruth);
assert.equal(age27.authority,"derived-continuity");
assert.equal(age27.creatorConfirmed,false);
const consistent=buildContinuityConsequenceEnvelope({creatorConfirmedContext:currentTruth,constraints:[age27],conflicts:[],unresolvedQuestions:[]});
assert.equal(consistent.status,"consistent");
assert.equal(consistent.requiresClarification,false);
const synthRequest={creatorMessage:"Continue ten years later.",creatorConfirmedContext:currentTruth,semanticIntelligence:{clarificationNeeded:[]},continuityConsequenceEnvelope:consistent,contributions:[{agentId:"story",authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false},{agentId:"character",authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false},{agentId:"continuity",authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false}]};
assert.equal(validateSynthesisRequest(synthRequest).valid,true,"consistent derived continuity must reach synthesis separately from creator truth");

const contradiction=buildContinuityConsequenceEnvelope({creatorConfirmedContext:currentTruth,constraints:[],conflicts:[{key:"location.tunnel",severity:"critical",requiresCreatorDecision:true,reason:"The tunnel was permanently collapsed but is being traversed again."}],unresolvedQuestions:[]});
assert.equal(contradiction.status,"contradiction");
assert.equal(contradiction.requiresClarification,true);
assert.equal(validateSynthesisRequest({...synthRequest,continuityConsequenceEnvelope:contradiction}).valid,false,"material continuity contradiction must block synthesis");
const clarification=continuityClarificationResponse({creatorMessage:"They go back through the tunnel.",semanticIntelligence:{},specialistPlan:plan,specialistResult:{contributions:[]},continuityContribution:{continuityConsequenceEnvelope:contradiction},turnContextProof:{revision:4},continuationResolution:{}});
assert.equal(clarification.status,"continuity-clarification-required");
assert.equal(clarification.synthesisResult,null);
assert.equal(clarification.creatorDecision.status,"not-committed");
assert.equal(clarification.mayAdvanceJourney,false);

console.log("Movie Mentor live Story + Character + Continuity + Synthesis wiring torture passed.");
