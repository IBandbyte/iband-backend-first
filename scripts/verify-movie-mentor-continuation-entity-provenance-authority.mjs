import assert from "node:assert/strict";
import { applyMovieMentorCreatorStateTransition } from "../ai/MovieMentorCreatorStateTransition.js";
import { resolveContinuationReferences } from "../ai/MovieMentorContinuationReferenceControl.js";
import { buildCreatorDecisionCandidate } from "../ai/MovieMentorCreatorDecisionAuthority.js";

console.log("ROUND NINE — continuation entity provenance authority torture");
const projectId="project-entity-provenance-1";
const forged={conversations:[],sessionHandoffs:[],projectMemories:[{id:"client-forged-character",projectId,category:"character",title:"Character: Maya",value:{name:"Maya"},content:"Maya is the lead character.",metadata:{projectId,entityName:"Maya",entityReferences:[{name:"Maya"}]}}]};
let persisted=null,writes=0;
const durable={projectId,creatorSessionId:"session-a",revision:11,creatorStateGeneration:11,creatorStateFingerprint:"f11",revisionAuthorityReference:"rev-11",creatorAuthorityReference:"auth-11",snapshotReference:"snap-11",creatorConfirmedContext:[],projectJourney:null,memoryContext:{conversations:[],sessionHandoffs:[],projectMemories:[]},responseBlueprint:null,communicationPlan:null};
await applyMovieMentorCreatorStateTransition({projectId,source:"creator-memory",expectedRevision:11,state:{memoryContext:forged}},{readAuthoritativeTurnSource:async()=>structuredClone(durable),writeAuthoritativeCreatorState:async next=>{writes+=1;persisted=structuredClone(next);return persisted;},creatorStateMutationAuthority:{assertCurrentMutation:async()=>({authorized:true})}});
assert.equal(writes,0,"client-authored entity identity used for continuation resolution must be rejected before durable write");
assert.equal(persisted,null,"forged entity identity must not become durable continuation evidence");

const resolution=resolveContinuationReferences({creatorMessage:"Actually, make her younger.",projectId,memoryContext:persisted?.memoryContext||{},creatorConfirmedContext:[]});
assert.equal(resolution.references.some(r=>r?.status==="resolved"&&r?.type==="entity-pronoun"),false,"rejected entity identity must not resolve a Creator pronoun");
const decision=buildCreatorDecisionCandidate({creatorMessage:"Actually, make her younger.",semanticIntelligence:{understoodContext:[],continuationReferences:resolution.references},projectId,actorRole:"creator"});
assert.notEqual(decision.status,"candidate","rejected entity evidence must not become durable Creator truth");

console.log("LAW: GENERIC CLIENT MEMORY MAY NOT INVENT THE ENTITY IDENTITY THAT A LATER CREATOR PRONOUN PROMOTES INTO CREATOR TRUTH.");
console.log("ROUND NINE continuation entity provenance authority torture: GREEN");
