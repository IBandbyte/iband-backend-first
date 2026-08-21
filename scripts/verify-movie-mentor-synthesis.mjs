import assert from "node:assert/strict";
import {validateSynthesisRequest,materialClarificationRequired,SYNTHESIS_SCHEMA} from "../ai/MovieMentorSynthesisEngine.js";
const safe={creatorMessage:"Two sisters find a radio that hears tomorrow.",semanticIntelligence:{clarificationNeeded:[]},contributions:[{agentId:"story",authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false}]};
assert.equal(validateSynthesisRequest(safe).valid,true);
assert.equal(materialClarificationRequired({clarificationNeeded:[{material:true}]}),true);
const blocked=validateSynthesisRequest({...safe,semanticIntelligence:{clarificationNeeded:[{material:true}]}});assert.equal(blocked.valid,false);assert.equal(blocked.issues.includes("material_semantic_clarification_blocks_synthesis"),true);
const unsafe=validateSynthesisRequest({...safe,contributions:[{agentId:"story",authority:"canonical",creatorFacing:true,mayAdvanceJourney:true,mayOverwriteCreatorTruth:true}]});assert.equal(unsafe.valid,false);assert.equal(unsafe.issues.length>=4,true);
assert.equal(SYNTHESIS_SCHEMA.additionalProperties,false);assert.equal(Object.hasOwn(SYNTHESIS_SCHEMA.properties,"journeyState"),false);assert.equal(Object.hasOwn(SYNTHESIS_SCHEMA.properties,"creatorTruth"),false);
console.log("Movie Mentor synthesis authority regression passed.");
