import assert from "node:assert/strict";
import { validateWorkOrder, validateContribution } from "../ai/MovieMentorSpecialistExecutor.js";

const baseWorkOrder={agentId:"story",authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,requiresMentorSynthesis:true,input:{creatorConfirmedContext:[{key:"movie.character.relationship",value:"siblings",authority:"creator"}]}};

const validPreflight=validateWorkOrder(baseWorkOrder);
assert.equal(validPreflight.valid,true,"valid specialist work order should pass");
assert.equal(validateWorkOrder({...baseWorkOrder,creatorFacing:true}).valid,false,"specialist must never be creator-facing");
assert.equal(validateWorkOrder({...baseWorkOrder,mayAdvanceJourney:true}).valid,false,"specialist must never advance journey");
assert.equal(validateWorkOrder({...baseWorkOrder,mayOverwriteCreatorTruth:true}).valid,false,"specialist must never overwrite creator truth");
assert.equal(validateWorkOrder({...baseWorkOrder,agentId:"cinematography"}).valid,false,"only Story and Character are live in v1");

const candidate={agentId:"story",observations:[],provisionalSuggestions:[{key:"story.option",value:"raise the stakes",reason:"possible direction",confidence:0.7}],risksAndConflicts:[],creatorConfirmedDependencies:[{key:"movie.character.relationship",value:"siblings"}],confidence:0.8,provenance:{source:"provider",model:"test",contractVersion:"1.0.0"}};
const validContribution=validateContribution(candidate,baseWorkOrder);
assert.equal(validContribution.valid,true,"valid contribution should pass");
assert.equal(validContribution.contribution.authority,"mentor-provisional");
assert.equal(validContribution.contribution.creatorFacing,false);
assert.equal(validContribution.contribution.mayAdvanceJourney,false);
assert.equal(validContribution.contribution.mayOverwriteCreatorTruth,false);

const falseTruth=validateContribution({...candidate,creatorConfirmedDependencies:[{key:"movie.character.relationship",value:"best friends"}]},baseWorkOrder);
assert.equal(falseTruth.valid,false,"agent may not invent creator-confirmed dependency");

console.log("Movie Mentor specialist executor verification passed.");
