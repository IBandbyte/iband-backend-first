import assert from "node:assert/strict";
import { createDerivedContinuityConstraint, buildContinuityConsequenceEnvelope, assertContinuityMayAdvance } from "../ai/MovieMentorContinuityConsequenceAuthority.js";
import { createContinuityWorkOrder, validateContinuityWorkOrder, validateAndBuildContribution } from "../ai/MovieMentorContinuityAgent.js";

const current=[
 {key:"creatorDecision.character.maya.age",value:"17",authority:"creator",confidenceSource:"creator-confirmed",current:true,decisionId:"d-age",decisionKey:"character.maya.age",decisionFingerprint:"a".repeat(64)},
 {key:"creatorDecision.timeline.jump",value:"10 years later",authority:"creator",confidenceSource:"creator-confirmed",current:true,decisionId:"d-jump",decisionKey:"timeline.jump",decisionFingerprint:"b".repeat(64)},
 {key:"creatorDecision.tunnel.state",value:"collapsed permanently",authority:"creator",confidenceSource:"creator-confirmed",current:true,decisionId:"d-tunnel",decisionKey:"tunnel.state",decisionFingerprint:"c".repeat(64)},
 {key:"creatorDecision.daniel.knowledge",value:"does not know Maya is his daughter",authority:"creator",confidenceSource:"creator-confirmed",current:true,decisionId:"d-knowledge",decisionKey:"daniel.knowledge",decisionFingerprint:"d".repeat(64)},
];
const historical={...current[2],current:false,decisionId:"old-tunnel",value:"open"};

const ageConstraint=createDerivedContinuityConstraint({category:"timeline",key:"character.maya.age.later",value:"27",reason:"Maya is 17 and the story moves ten years later.",confidence:1,dependencies:[{key:current[0].key,value:"17"},{key:current[1].key,value:"10 years later"}]},current);
assert.equal(ageConstraint.authority,"derived-continuity");
assert.equal(ageConstraint.creatorConfirmed,false);
assert.equal(ageConstraint.mayCreateCanon,false);

assert.throws(()=>createDerivedContinuityConstraint({category:"location",key:"tunnel.state",value:"open",reason:"stale resurrection",confidence:1,dependencies:[{key:historical.key,value:"open"}]},[...current,historical]),/Superseded|malformed|current creator truth/i);

const work=createContinuityWorkOrder({creatorMessage:"They go back through the tunnel.",currentCreatorTruth:current});
assert.equal(validateContinuityWorkOrder(work).valid,true);
const badWork={...work,input:{...work.input,currentCreatorTruth:[...current,historical]}};
assert.equal(validateContinuityWorkOrder(badWork).valid,false);

const contradictionCandidate={agentId:"continuity",derivedConstraints:[{category:"timeline",key:"character.maya.age.later",value:"27",reason:"Maya is 17 and ten years pass.",confidence:1,dependencies:[{key:current[0].key,value:"17"},{key:current[1].key,value:"10 years later"}]}],continuityConflicts:[{key:"tunnel.state",category:"object-state",existingValue:"collapsed permanently",proposedValue:"characters traverse tunnel",severity:"critical",reason:"Traversal contradicts the current permanent-collapse decision.",requiresCreatorDecision:true,confidence:1}],unresolvedContinuityQuestions:[],provisionalSuggestions:[],confidence:1,provenance:{source:"test",model:null,contractVersion:"2.0.0"}};
const validated=validateAndBuildContribution(contradictionCandidate,work);
assert.equal(validated.valid,true);
assert.equal(validated.contribution.continuityConsequenceEnvelope.status,"contradiction");
assert.equal(validated.contribution.continuityConsequenceEnvelope.requiresClarification,true);
assert.throws(()=>assertContinuityMayAdvance(validated.contribution.continuityConsequenceEnvelope),/clarification/i);

const unresolved=buildContinuityConsequenceEnvelope({creatorConfirmedContext:current,constraints:[ageConstraint],conflicts:[],unresolvedQuestions:[{key:"clock",question:"Which calendar date anchors the jump?"}]});
assert.equal(unresolved.status,"unresolved");
assert.equal(unresolved.mayAdvanceJourney,false);

const consistent=buildContinuityConsequenceEnvelope({creatorConfirmedContext:current,constraints:[ageConstraint],conflicts:[],unresolvedQuestions:[]});
assert.equal(consistent.status,"consistent");
assert.equal(assertContinuityMayAdvance(consistent),true);

const knowledge=createDerivedContinuityConstraint({category:"knowledge",key:"daniel.mayActOnFatherhood",value:"false",reason:"Daniel cannot act on a fact he does not know.",confidence:1,dependencies:[{key:current[3].key,value:"does not know Maya is his daughter"}]},current);
assert.equal(knowledge.creatorConfirmed,false);

console.log("Movie Mentor standalone continuity authority torture: GREEN");
