import assert from "node:assert/strict";
import { buildCreatorDecisionCandidate, mergeDecisionIntoCreatorContext, commitCreatorDecision } from "../ai/MovieMentorCreatorDecisionAuthority.js";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";

const directSemantic={understoodContext:[{key:"story.route",value:"hidden tunnel",evidence:"Let's use the hidden tunnel",confidenceSource:"creator-explicit"}],continuationReferences:[]};
let result=buildCreatorDecisionCandidate({creatorMessage:"Yes. Let's use the hidden tunnel.",semanticIntelligence:directSemantic,projectId:"p1"});
assert.equal(result.status,"candidate");assert.equal(result.candidate.authority,"creator-explicit");assert.equal(result.candidate.value,"hidden tunnel");assert.match(result.candidate.fingerprint,/^[a-f0-9]{64}$/);

assert.equal(buildCreatorDecisionCandidate({creatorMessage:"Maybe we could use the hidden tunnel.",semanticIntelligence:directSemantic,projectId:"p1"}).status,"none");
assert.equal(buildCreatorDecisionCandidate({creatorMessage:"Yes. Let's use the hidden tunnel.",semanticIntelligence:directSemantic,projectId:"p1",actorRole:"mentor"}).status,"rejected");

const contextualSemantic={understoodContext:[],continuationReferences:[{expression:"that",type:"prior-mentor-proposal",status:"resolved",resolvedValue:"hidden tunnel",source:"project-conversation"}]};
result=buildCreatorDecisionCandidate({creatorMessage:"Yes, do that.",semanticIntelligence:contextualSemantic,projectId:"p1"});assert.equal(result.status,"candidate");assert.equal(result.candidate.value,"hidden tunnel");assert.equal(result.candidate.decisionKey,"continuation.prior-mentor-proposal");

const foreign={...result.candidate,projectId:"p2"};await assert.rejects(()=>commitCreatorDecision({candidate:foreign,expectedRevision:7,projectId:"p1"}),e=>e.code==="MOVIE_MENTOR_CREATOR_DECISION_PROJECT_MISMATCH");

let state={projectId:"p1",creatorSessionId:"s1",revision:7,revisionAuthorityReference:"rev-7",creatorStateGeneration:3,creatorStateFingerprint:"state-3",creatorAuthorityReference:"auth-3",snapshotReference:"snap-7",creatorConfirmedContext:[],projectJourney:null,memoryContext:null,responseBlueprint:null,communicationPlan:null,capturedAt:new Date().toISOString()};
const read=async()=>structuredClone(state);
const write=async(next,{expectedRevision})=>{if(state.revision!==expectedRevision){const e=new Error("conflict");e.code="MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT";throw e;}state=structuredClone(next);return structuredClone(state);};
const candidate=result.candidate;
const committed=await commitCreatorDecision({candidate,expectedRevision:7,projectId:"p1",creatorSessionId:"s1"},{readAuthoritativeTurnSource:read,applyMovieMentorCreatorStateTransition,writeAuthoritativeCreatorState:write});
assert.equal(committed.status,"committed");assert.equal(state.revision,8);assert.equal(state.creatorConfirmedContext.at(-1).value,"hidden tunnel");assert.equal(state.creatorConfirmedContext.at(-1).current,true);

const correctionSemantic={understoodContext:[{key:"story.route",value:"lighthouse",evidence:"Actually scrap the tunnel. Use the lighthouse.",confidenceSource:"creator-explicit"}],continuationReferences:[]};
const correction=buildCreatorDecisionCandidate({creatorMessage:"Actually scrap the tunnel. Use the lighthouse.",semanticIntelligence:correctionSemantic,projectId:"p1"});assert.equal(correction.status,"candidate");assert.equal(correction.candidate.intent,"correction");
const beforeCorrection=[{key:"creatorDecision.semantic.story.route",value:"hidden tunnel",decisionKey:"semantic.story.route",decisionId:"old",current:true}];const merged=mergeDecisionIntoCreatorContext(beforeCorrection,correction.candidate);assert.equal(merged[0].current,false);assert.equal(merged[0].supersededByDecisionId,correction.candidate.decisionId);assert.equal(merged[1].value,"lighthouse");assert.equal(merged[1].current,true);

await assert.rejects(()=>commitCreatorDecision({candidate:correction.candidate,expectedRevision:7,projectId:"p1",creatorSessionId:"s1"},{readAuthoritativeTurnSource:read,applyMovieMentorCreatorStateTransition,writeAuthoritativeCreatorState:write}),e=>e.code==="MOVIE_MENTOR_CREATOR_DECISION_REVISION_CONFLICT");

console.log("Movie Mentor creator decision authority verification: PASS");
