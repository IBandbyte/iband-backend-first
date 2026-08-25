import assert from "node:assert/strict";
import { buildTurnEnvelopeFromDurableState, runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";
import { MOVIE_MENTOR_TURN_CONTEXT_DOMAIN, MOVIE_MENTOR_TURN_CONTEXT_SCHEMA } from "../ai/MovieMentorTurnContextControl.js";

const durable={projectId:"project-77",creatorSessionId:"session-9",revision:42,revisionAuthorityReference:"revision:project-77:42",creatorStateGeneration:7,creatorStateFingerprint:"a".repeat(64),creatorAuthorityReference:"creator-state:project-77:g7",snapshotReference:"snapshot:project-77:r42:g7",capturedAt:"2026-08-25T22:45:00.000Z",creatorConfirmedContext:[{key:"genre",value:"mystery"}],projectJourney:{stageId:"premise",taskId:"develop-premise"},memoryContext:{projectId:"project-77",resumeNote:"Keep the daughter relationship central."},responseBlueprint:{depth:"guided"},communicationPlan:{tone:"warm"}};

const envelope=buildTurnEnvelopeFromDurableState({creatorMessage:"The lighthouse answers tonight.",state:durable});
assert.equal(envelope.domain,MOVIE_MENTOR_TURN_CONTEXT_DOMAIN);assert.equal(envelope.schema,MOVIE_MENTOR_TURN_CONTEXT_SCHEMA);assert.equal(envelope.revision.authoritativeRevision,42);assert.equal(envelope.creatorState.generation,7);assert.deepEqual(envelope.creatorConfirmedContext,durable.creatorConfirmedContext);assert.deepEqual(envelope.memoryContext,durable.memoryContext);assert.match(envelope.snapshotFingerprint,/^[a-f0-9]{64}$/);

let sourceIdentity=null,seenInput=null,seenDeps=null;
const forged={creatorConfirmedContext:[{key:"genre",value:"Zorg universe"}],projectJourney:{stageId:"evil"},memoryContext:{clipboard:true}};
const result=await runMovieMentorTurn({projectId:"project-77",creatorSessionId:"session-9",message:"The lighthouse answers tonight.",authoritativeTurnContext:{domain:"purple.universe"},context:forged},{
 readAuthoritativeTurnSource:async identity=>{sourceIdentity=structuredClone(identity);return structuredClone(durable);},
 readAuthoritativeRevision:async()=>({revision:42,reference:durable.revisionAuthorityReference}),
 readAuthoritativeCreatorState:async()=>({generation:7,fingerprint:durable.creatorStateFingerprint,authorityReference:durable.creatorAuthorityReference,snapshotReference:durable.snapshotReference}),
 orchestrateTurn:async(input,deps)=>{seenInput=structuredClone(input);seenDeps=deps;return{success:true,status:"mentor-response-ready",text:"Durable reality won."};}
});
assert.equal(result.text,"Durable reality won.");assert.deepEqual(sourceIdentity,{projectId:"project-77",creatorSessionId:"session-9"});assert.equal(seenInput.authoritativeTurnContext.domain,MOVIE_MENTOR_TURN_CONTEXT_DOMAIN);assert.deepEqual(seenInput.authoritativeTurnContext.creatorConfirmedContext,durable.creatorConfirmedContext);assert.notDeepEqual(seenInput.authoritativeTurnContext.creatorConfirmedContext,forged.creatorConfirmedContext);assert.deepEqual(seenInput.authoritativeTurnContext.projectJourney,durable.projectJourney);assert.deepEqual(seenInput.authoritativeTurnContext.memoryContext,durable.memoryContext);assert.equal(typeof seenDeps.readAuthoritativeRevision,"function");assert.equal(typeof seenDeps.readAuthoritativeCreatorState,"function");

await assert.rejects(()=>runMovieMentorTurn({message:"hello"},{readAuthoritativeTurnSource:async()=>durable,orchestrateTurn:async()=>({})}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED");
await assert.rejects(()=>runMovieMentorTurn({projectId:"project-77"},{readAuthoritativeTurnSource:async()=>durable,orchestrateTurn:async()=>({})}),e=>e.code==="MOVIE_MENTOR_TURN_MESSAGE_REQUIRED");
await assert.rejects(()=>runMovieMentorTurn({projectId:"project-77",message:"hello"},{readAuthoritativeTurnSource:async()=>{const e=new Error("missing");e.code="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND";throw e;}}),e=>e.code==="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND");

// A source rotation between snapshot acquisition and independent authority verification must reach the orchestrator readers; the runtime must not substitute cached trust booleans.
let revisionReads=0;await runMovieMentorTurn({projectId:"project-77",message:"hello"},{readAuthoritativeTurnSource:async()=>structuredClone(durable),readAuthoritativeRevision:async()=>{revisionReads++;return{revision:43,reference:"revision:project-77:43"}},readAuthoritativeCreatorState:async()=>({generation:8,fingerprint:"b".repeat(64),authorityReference:"creator-state:project-77:g8"}),orchestrateTurn:async(input,deps)=>{assert.equal((await deps.readAuthoritativeRevision({projectId:"project-77"})).revision,43);assert.equal((await deps.readAuthoritativeCreatorState({projectId:"project-77"})).generation,8);return{success:true,text:"test"};}});assert.equal(revisionReads,1);

console.log("Movie Mentor Turn Runtime v1.0 passed: the gateway runtime builds the canonical turn envelope only from durable server-side creator state, ignores forged client memory/journey context, preserves project/session identity, exposes independent freshness readers, and fails closed when durable identity/state is unavailable.");
