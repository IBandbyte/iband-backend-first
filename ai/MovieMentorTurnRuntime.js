import { createTurnContextEnvelope } from "./MovieMentorTurnContextControl.js";
import { orchestrateMovieMentorTurn } from "./MovieMentorTurnOrchestrator.js";
import { readAuthoritativeTurnSource,readAuthoritativeRevision,readAuthoritativeCreatorState } from "./MovieMentorCreatorStateStore.js";

const MOVIE_MENTOR_TURN_RUNTIME_VERSION="1.0.0";
function s(v){return typeof v==="string"?v.trim():"";}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function messageFrom(input){return s(input?.input?.message||input?.message||"");}
function identityFrom(input){return{projectId:s(input?.projectId||input?.context?.projectId)||null,creatorSessionId:s(input?.creatorSessionId||input?.context?.creatorSessionId)||null};}
function runtimeError(code,message){const error=new Error(message);error.code=code;return error;}

function buildTurnEnvelopeFromDurableState({creatorMessage,state}={}){
 if(!s(creatorMessage))throw runtimeError("MOVIE_MENTOR_TURN_MESSAGE_REQUIRED","A creator message is required for a Movie Mentor turn.");
 if(!state||typeof state!=="object")throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_INVALID","Durable creator state is required to build a Movie Mentor turn.");
 return createTurnContextEnvelope({
  projectId:state.projectId||null,creatorSessionId:state.creatorSessionId||null,creatorMessage:s(creatorMessage),
  revision:{capturedRevision:state.revision,authoritativeRevision:state.revision,authorityReference:state.revisionAuthorityReference},
  creatorState:{generation:state.creatorStateGeneration,fingerprint:state.creatorStateFingerprint,authorityReference:state.creatorAuthorityReference},
  snapshotReference:state.snapshotReference,capturedAt:state.capturedAt,
  creatorConfirmedContext:clone(state.creatorConfirmedContext||[]),projectJourney:clone(state.projectJourney??null),memoryContext:clone(state.memoryContext??null),responseBlueprint:clone(state.responseBlueprint??null),communicationPlan:clone(state.communicationPlan??null)
 });
}

async function runMovieMentorTurn(input={},deps={}){
 const creatorMessage=messageFrom(input);
 if(!creatorMessage)throw runtimeError("MOVIE_MENTOR_TURN_MESSAGE_REQUIRED","A creator message is required for a Movie Mentor turn.");
 const identity=identityFrom(input);
 if(!identity.projectId&&!identity.creatorSessionId)throw runtimeError("MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED","projectId or creatorSessionId is required for a durable Movie Mentor turn.");
 const readSource=deps.readAuthoritativeTurnSource||readAuthoritativeTurnSource;
 const revisionReader=deps.readAuthoritativeRevision||readAuthoritativeRevision;
 const stateReader=deps.readAuthoritativeCreatorState||readAuthoritativeCreatorState;
 const orchestrate=deps.orchestrateTurn||orchestrateMovieMentorTurn;
 const state=await readSource(identity);
 const envelope=buildTurnEnvelopeFromDurableState({creatorMessage,state});
 // Deliberately discard any client-supplied context envelope or memory/journey truth. The durable server-side snapshot is authoritative.
 return orchestrate({message:creatorMessage,authoritativeTurnContext:envelope,options:clone(input?.options||{})},{readAuthoritativeRevision:revisionReader,readAuthoritativeCreatorState:stateReader});
}

export{MOVIE_MENTOR_TURN_RUNTIME_VERSION,buildTurnEnvelopeFromDurableState,runMovieMentorTurn};
export default runMovieMentorTurn;
