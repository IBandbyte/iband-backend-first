import assert from "node:assert/strict";
import { buildContinuationObedienceEnvelope, validateObedienceClaims } from "../ai/MovieMentorContinuationObedienceControl.js";
import { validateContribution } from "../ai/MovieMentorSpecialistExecutor.js";
import { verifySpecialistObedience, verifySynthesisObedience } from "../ai/MovieMentorTurnOrchestrator.js";

function semantic(reference){return {continuationReferences:[{domain:"iband.movie-mentor.continuation-reference",schema:1,status:"resolved",material:true,confidenceSource:"creator-confirmed",source:"project-conversation",...reference}]};}
function claim(ref,status="obeyed",digest=ref.resolvedValueDigest){return {referenceId:ref.referenceId,status,resolvedValueDigest:status==="not-applicable"?null:digest,reason:null};}
function contribution(agentId,claims){return {agentId,observations:[],provisionalSuggestions:[],risksAndConflicts:[],creatorConfirmedDependencies:[],continuationObedienceClaims:claims,confidence:.8,provenance:{source:"test",model:"test",contractVersion:"1.1.0"},authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,requiresMentorSynthesis:true};}
function workOrder(agentId,envelope){return {agentId,authority:"mentor-provisional",creatorFacing:false,mayAdvanceJourney:false,mayOverwriteCreatorTruth:false,input:{creatorConfirmedContext:[],continuationObedienceEnvelope:envelope}};}

const thatEnvelope=buildContinuationObedienceEnvelope(semantic({expression:"that",type:"prior-mentor-proposal",resolvedValue:"Use the hidden tunnel beneath the cliffs."}));
assert.equal(thatEnvelope.references.length,1);assert.match(thatEnvelope.references[0].resolvedValueDigest,/^[a-f0-9]{64}$/);
const thatRef=thatEnvelope.references[0];
assert.equal(validateContribution(contribution("story",[claim(thatRef)]),workOrder("story",thatEnvelope)).valid,true,"Story may obey the resolved 'that' reference");
assert.equal(validateContribution(contribution("story",[claim(thatRef,"obeyed","f".repeat(64))]),workOrder("story",thatEnvelope)).valid,false,"Story may not silently substitute another meaning for 'that'");
assert.equal(validateContribution(contribution("character",[claim(thatRef,"not-applicable")]),workOrder("character",thatEnvelope)).valid,true,"A genuinely irrelevant specialist may explicitly declare not-applicable");

const herEnvelope=buildContinuationObedienceEnvelope(semantic({expression:"her",type:"entity-pronoun",resolvedValue:{name:"Maya"},source:"project-memory"}));
const herRef=herEnvelope.references[0];
assert.throws(()=>verifySpecialistObedience([contribution("character",[claim(herRef,"obeyed","0".repeat(64))])],herEnvelope),e=>e.code==="MOVIE_MENTOR_SPECIALIST_CONTINUATION_OBEDIENCE_FAILED"&&e.validationIssues.some(x=>x.includes("value_drift")),"Character may not turn Maya into Sarah");
verifySpecialistObedience([contribution("story",[claim(herRef,"not-applicable")]),contribution("character",[claim(herRef)])],herEnvelope);

const secondEnvelope=buildContinuationObedienceEnvelope(semantic({expression:"the second idea",type:"ordinal-option",resolvedValue:{index:2,text:"The hidden tunnel beneath the cliffs."}}));
const secondRef=secondEnvelope.references[0];
assert.throws(()=>verifySynthesisObedience({continuationObedienceClaims:[claim(secondRef,"obeyed","1".repeat(64))]},secondEnvelope),e=>e.code==="MOVIE_MENTOR_SYNTHESIS_CONTINUATION_OBEDIENCE_FAILED","Synthesis may not answer with option one after Semantic resolved option two");
assert.throws(()=>verifySynthesisObedience({continuationObedienceClaims:[]},secondEnvelope),e=>e.validationIssues.some(x=>x.includes("proof_missing")),"Creator-facing synthesis may not omit obedience proof");
verifySynthesisObedience({continuationObedienceClaims:[claim(secondRef)]},secondEnvelope);

const correctionEnvelope=buildContinuationObedienceEnvelope({continuationReferences:[{expression:"her",type:"entity-pronoun",status:"resolved",resolvedValue:{name:"Maya"},confidenceSource:"creator-confirmed",material:true}],understoodContext:[{key:"movie.character.age",value:"younger",evidence:"Actually, make her younger",confidenceSource:"creator-explicit"}]});
assert.equal(correctionEnvelope.references[0].resolvedValue.name,"Maya","Continuation evidence must preserve the resolved entity while current creator-explicit correction remains separate authority");

console.log("Movie Mentor continuation obedience verification: PASS — validated Semantic references are immutable through specialist and creator-facing synthesis boundaries.");
