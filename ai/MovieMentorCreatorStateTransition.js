import { createHash, randomUUID } from "node:crypto";
import { readAuthoritativeTurnSource,writeAuthoritativeCreatorState } from "./MovieMentorCreatorStateStore.js";

const MOVIE_MENTOR_CREATOR_STATE_TRANSITION_VERSION="1.0.0";
const ALLOWED_FIELDS=Object.freeze(["creatorConfirmedContext","projectJourney","memoryContext","responseBlueprint","communicationPlan"]);
function s(v){return typeof v==="string"?v.trim():"";}
function n(v){return Number.isSafeInteger(v)&&v>=0?v:null;}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>(o[k]=stable(v[k]),o),{});return v;}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");}
function fail(code,message){const e=new Error(message);e.code=code;return e;}
function identityFrom(input={}){return{projectId:s(input.projectId)||null,creatorSessionId:s(input.creatorSessionId)||null};}
function assertIdentity(identity){if(!identity.projectId&&!identity.creatorSessionId)throw fail("MOVIE_MENTOR_CREATOR_STATE_IDENTITY_REQUIRED","projectId or creatorSessionId is required for a creator state transition.");}
function proposedFields(input={}){const proposed=input.state&&typeof input.state==="object"?input.state:{};const out={};for(const key of ALLOWED_FIELDS)if(Object.prototype.hasOwnProperty.call(proposed,key))out[key]=clone(proposed[key]);return out;}
function assertNoAuthorityInjection(input={}){const proposed=input.state&&typeof input.state==="object"?input.state:{};const forbidden=["revision","revisionAuthorityReference","creatorStateGeneration","creatorStateFingerprint","creatorAuthorityReference","snapshotReference","capturedAt","updatedAt","createdAt","authorityReference","fingerprint","generation"];
 for(const key of forbidden)if(Object.prototype.hasOwnProperty.call(proposed,key)||Object.prototype.hasOwnProperty.call(input,key)&&!["expectedRevision"].includes(key))throw fail("MOVIE_MENTOR_CREATOR_STATE_AUTHORITY_INJECTION","Client may not supply server authority fields.");}
function transitionSource(input={}){const source=s(input.source);if(!["creator-memory","creator-journey","creator-workspace"].includes(source))throw fail("MOVIE_MENTOR_CREATOR_STATE_SOURCE_NOT_AUTHORIZED","Creator state transition source is not authorized.");return source;}
function buildNextState({current,input,identity}={}){
 const expected=n(input.expectedRevision);if(current&&expected===null)throw fail("MOVIE_MENTOR_CREATOR_STATE_EXPECTED_REVISION_REQUIRED","expectedRevision is required when updating durable creator state.");
 if(current&&expected!==current.revision)throw fail("MOVIE_MENTOR_CREATOR_STATE_REVISION_CONFLICT","Durable creator state changed before this transition could be applied.");
 if(!current&&expected!==0)throw fail("MOVIE_MENTOR_CREATOR_STATE_INITIAL_REVISION_REQUIRED","Initial durable creator state creation requires expectedRevision 0.");
 const patch=proposedFields(input);if(!Object.keys(patch).length)throw fail("MOVIE_MENTOR_CREATOR_STATE_TRANSITION_EMPTY","Creator state transition contains no permitted state fields.");
 const base=current||{projectId:identity.projectId,creatorSessionId:identity.creatorSessionId,revision:0,creatorStateGeneration:0,creatorConfirmedContext:[],projectJourney:null,memoryContext:null,responseBlueprint:null,communicationPlan:null};
 const revision=current?current.revision+1:1,generation=current?current.creatorStateGeneration+1:1,capturedAt=new Date().toISOString();
 const state={projectId:identity.projectId||base.projectId||null,creatorSessionId:identity.creatorSessionId||base.creatorSessionId||null,creatorConfirmedContext:clone(base.creatorConfirmedContext||[]),projectJourney:clone(base.projectJourney??null),memoryContext:clone(base.memoryContext??null),responseBlueprint:clone(base.responseBlueprint??null),communicationPlan:clone(base.communicationPlan??null),...patch};
 const transitionId=randomUUID(),source=transitionSource(input),fingerprint=digest({projectId:state.projectId,creatorSessionId:state.creatorSessionId,generation,state});
 return{...state,revision,revisionAuthorityReference:`movie-mentor:revision:${revision}:${transitionId}`,creatorStateGeneration:generation,creatorStateFingerprint:fingerprint,creatorAuthorityReference:`movie-mentor:creator-state:${generation}:${transitionId}`,snapshotReference:`movie-mentor:snapshot:${revision}:${fingerprint.slice(0,24)}`,capturedAt,transition:{id:transitionId,source,expectedRevision:expected}};
}

async function applyMovieMentorCreatorStateTransition(input={},deps={}){
 assertNoAuthorityInjection(input);const identity=identityFrom(input);assertIdentity(identity);transitionSource(input);
 const read=deps.readAuthoritativeTurnSource||readAuthoritativeTurnSource,write=deps.writeAuthoritativeCreatorState||writeAuthoritativeCreatorState;
 let current=null;try{current=await read(identity);}catch(error){if(error?.code!=="MOVIE_MENTOR_CREATOR_STATE_NOT_FOUND")throw error;}
 const next=buildNextState({current,input,identity});return write(next,{expectedRevision:next.transition.expectedRevision});
}

export{MOVIE_MENTOR_CREATOR_STATE_TRANSITION_VERSION,ALLOWED_FIELDS,buildNextState,applyMovieMentorCreatorStateTransition};
export default applyMovieMentorCreatorStateTransition;
