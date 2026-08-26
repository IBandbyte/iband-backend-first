import assert from "node:assert/strict";
import { resolveContinuationReferences, mergeContinuationIntoSemanticIntelligence } from "../ai/MovieMentorContinuationReferenceControl.js";

function memoryFor(projectId="p1"){
  return {
    conversations:[{
      id:"c1",relatedProjectIds:[projectId],creatorMessage:"Give me three ways she could enter the lighthouse.",mentorResponse:"1. She arrives by boat in a storm.\n2. She discovers a hidden tunnel beneath the cliffs.\n3. She climbs the exterior maintenance ladder.",metadata:{projectId,entityReferences:[{name:"Maya"}]},createdAt:"2026-08-25T20:00:00.000Z"
    }],
    sessionHandoffs:[{
      id:"h1",projectId,value:{conversationId:"c1",lastCreatorMessage:"Give me three ways she could enter the lighthouse.",lastMentorResponse:"1. She arrives by boat in a storm.\n2. She discovers a hidden tunnel beneath the cliffs.\n3. She climbs the exterior maintenance ladder."},content:"Continue from the lighthouse entrance options.",createdAt:"2026-08-25T20:01:00.000Z"
    }],
    projectMemories:[{id:"pm1",projectId,category:"character",title:"Character: Maya",value:{name:"Maya"},content:"Maya is the lead character.",metadata:{projectId,entityName:"Maya"}}]
  };
}
function one(message,memoryContext=memoryFor(),projectId="p1"){return resolveContinuationReferences({creatorMessage:message,projectId,memoryContext,creatorConfirmedContext:[]});}

let r=one("Yes, do that.");assert.equal(r.hasMaterialAmbiguity,false);assert.equal(r.references[0].status,"resolved");assert.equal(r.references[0].type,"prior-mentor-proposal");
r=one("Carry on from there.");assert.equal(r.references[0].type,"continuation-position");assert.equal(r.references[0].resolvedValue.handoffId,"h1");
r=one("I prefer the second idea.");assert.equal(r.references[0].type,"ordinal-option");assert.equal(r.references[0].resolvedValue.index,2);assert.match(r.references[0].resolvedValue.text,/hidden tunnel/i);
r=one("Actually, make her younger.");assert.equal(r.references[0].type,"entity-pronoun");assert.equal(r.references[0].resolvedValue.name,"Maya");

r=one("I prefer the second idea.",{conversations:[{id:"other",relatedProjectIds:["p2"],mentorResponse:"1. Red\n2. Blue",metadata:{projectId:"p2"}}]},"p1");assert.equal(r.hasMaterialAmbiguity,true);assert.equal(r.references[0].status,"ambiguous");

r=one("Actually, make her younger.",{...memoryFor(),projectMemories:[{projectId:"p1",category:"character",value:{name:"Maya"},metadata:{entityName:"Maya"}},{projectId:"p1",category:"character",value:{name:"Elena"},metadata:{entityName:"Elena"}}]});assert.equal(r.hasMaterialAmbiguity,true);assert.equal(r.references[0].status,"ambiguous");

const semantic={understoodContext:[{key:"movie.character.age",value:"younger",evidence:"Actually, make her younger.",confidenceSource:"creator-explicit"}],provisionalContext:[],unresolvedContext:[],clarificationNeeded:[],readyToAdvance:true,recommendedStageId:null,recommendedTaskId:null,nextAction:null,resumeNote:null};
r=one("Actually, make her younger.");const merged=mergeContinuationIntoSemanticIntelligence(semantic,r);assert.equal(merged.readyToAdvance,true);assert.equal(merged.understoodContext[0].confidenceSource,"creator-explicit");assert.equal(merged.continuationReferences[0].resolvedValue.name,"Maya");

const uncertain=resolveContinuationReferences({creatorMessage:"Actually, make her younger.",projectId:"p1",memoryContext:{conversations:[],projectMemories:[]}});const blocked=mergeContinuationIntoSemanticIntelligence(semantic,uncertain);assert.equal(blocked.readyToAdvance,false);assert.ok(blocked.clarificationNeeded.some(x=>x.material===true));assert.ok(blocked.continuationReferences.every(x=>x.confidenceSource==="model-provisional"));

console.log("Movie Mentor continuation reference verification: PASS");
