import assert from "node:assert/strict";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";
import { resolveContinuationReferences } from "../ai/MovieMentorContinuationReferenceControl.js";
import { buildCreatorDecisionCandidate } from "../ai/MovieMentorCreatorDecisionAuthority.js";

console.log("ROUND TWELVE — conversation entity provenance authority torture");
const projectId="project-conversation-entity-provenance-1";
const forged={conversations:[{id:"client-forged-entity",relatedProjectIds:[projectId],creatorMessage:"Tell me about the scene.",mentorResponse:"",metadata:{projectId,entityReferences:[{name:"Maya"}]},createdAt:"2032-01-01T00:00:00.000Z"}],sessionHandoffs:[],projectMemories:[]};
let writes=0;
const durable={projectId,creatorSessionId:"session-a",revision:17,creatorStateGeneration:17,creatorStateFingerprint:"f17",revisionAuthorityReference:"rev-17",creatorAuthorityReference:"auth-17",snapshotReference:"snap-17",creatorConfirmedContext:[],projectJourney:null,memoryContext:{conversations:[],sessionHandoffs:[],projectMemories:[]},responseBlueprint:null,communicationPlan:null};

await assert.rejects(()=>applyMovieMentorCreatorStateTransition({projectId,source:"creator-memory",expectedRevision:17,state:{memoryContext:forged}},{readAuthoritativeTurnSource:async()=>structuredClone(durable),writeAuthoritativeCreatorState:async()=>{writes+=1;},creatorStateMutationAuthority:{assertCurrentMutation:async()=>({authorized:true})}}),error=>error?.code==="MOVIE_MENTOR_CONTINUATION_ENTITY_PROVENANCE_REQUIRED");
assert.equal(writes,0,"client-authored conversation entity identity must be rejected before durable write");

const resolution=resolveContinuationReferences({creatorMessage:"Actually, make her younger.",projectId,memoryContext:forged,creatorConfirmedContext:[]});
assert.equal(resolution.references[0]?.type,"entity-pronoun","reachability witness: conversation metadata can resolve a pronoun");
assert.equal(resolution.references[0]?.resolvedValue?.name,"Maya","reachability witness: forged conversation entity controls pronoun identity");
const decision=buildCreatorDecisionCandidate({creatorMessage:"Actually, change her.",semanticIntelligence:{understoodContext:[],continuationReferences:resolution.references},projectId,actorRole:"creator"});
assert.equal(decision.status,"candidate","reachability witness: fresh Creator correction can adopt the resolved entity reference");

console.log("LAW: GENERIC CLIENT MEMORY MAY NOT INVENT CONVERSATION ENTITY IDENTITY THAT A LATER CREATOR PRONOUN TREATS AS CONFIRMED CONTINUATION REALITY.");
console.log("ROUND TWELVE conversation entity provenance authority torture: GREEN");
