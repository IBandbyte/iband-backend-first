import { createHash } from "node:crypto";

const MOVIE_MENTOR_TURN_CONTEXT_VERSION="1.0.0";
const MOVIE_MENTOR_TURN_CONTEXT_DOMAIN="iband.movie-mentor.turn-context";
const MOVIE_MENTOR_TURN_CONTEXT_SCHEMA=1;
const MOVIE_MENTOR_TURN_CONTEXT_AUTHORITY="authoritative-creator-turn-context";

function s(v){return typeof v==="string"?v.trim():"";}
function n(v){return Number.isSafeInteger(v)&&v>=0?v:null;}
function a(v){return Array.isArray(v)?v:[];}
function clone(v){if(v===undefined)return undefined;try{return JSON.parse(JSON.stringify(v));}catch{return v;}}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.keys(v).sort().reduce((o,k)=>(o[k]=stable(v[k]),o),{});return v;}
function digestPayload(payload){return createHash("sha256").update(JSON.stringify(stable({domain:MOVIE_MENTOR_TURN_CONTEXT_DOMAIN,schema:MOVIE_MENTOR_TURN_CONTEXT_SCHEMA,payload}))).digest("hex");}
function fingerprintPayload(e={}){return{projectId:s(e.projectId)||null,creatorSessionId:s(e.creatorSessionId)||null,creatorMessage:s(e.creatorMessage),revision:{capturedRevision:n(e?.revision?.capturedRevision),authoritativeRevision:n(e?.revision?.authoritativeRevision),authorityReference:s(e?.revision?.authorityReference)},creatorState:{generation:n(e?.creatorState?.generation),fingerprint:s(e?.creatorState?.fingerprint),authorityReference:s(e?.creatorState?.authorityReference)},snapshotReference:s(e.snapshotReference),capturedAt:s(e.capturedAt),creatorConfirmedContext:clone(a(e.creatorConfirmedContext)),projectJourney:clone(e.projectJourney??null),memoryContext:clone(e.memoryContext??null),responseBlueprint:clone(e.responseBlueprint??null),communicationPlan:clone(e.communicationPlan??null)};}

function createTurnContextEnvelope(input={}){
 const payload=fingerprintPayload(input);
 return{domain:MOVIE_MENTOR_TURN_CONTEXT_DOMAIN,schema:MOVIE_MENTOR_TURN_CONTEXT_SCHEMA,version:MOVIE_MENTOR_TURN_CONTEXT_VERSION,authority:MOVIE_MENTOR_TURN_CONTEXT_AUTHORITY,...payload,snapshotFingerprint:digestPayload(payload)};
}

async function verifyAuthoritativeTurnContext(envelope={},deps={}){
 const reasons=[];
 if(envelope?.domain!==MOVIE_MENTOR_TURN_CONTEXT_DOMAIN)reasons.push("turn_context_domain_mismatch");
 if(envelope?.schema!==MOVIE_MENTOR_TURN_CONTEXT_SCHEMA)reasons.push("turn_context_schema_mismatch");
 if(envelope?.authority!==MOVIE_MENTOR_TURN_CONTEXT_AUTHORITY)reasons.push("turn_context_authority_mismatch");
 if(!s(envelope.projectId)&&!s(envelope.creatorSessionId))reasons.push("project_or_creator_session_required");
 if(!s(envelope.creatorMessage))reasons.push("creator_message_required");
 const captured=n(envelope?.revision?.capturedRevision),authoritative=n(envelope?.revision?.authoritativeRevision);
 if(captured===null||authoritative===null)reasons.push("turn_context_revision_required");
 else if(captured!==authoritative)reasons.push("turn_context_not_latest_revision");
 if(!s(envelope?.revision?.authorityReference))reasons.push("revision_authority_reference_required");
 if(n(envelope?.creatorState?.generation)===null||!s(envelope?.creatorState?.fingerprint)||!s(envelope?.creatorState?.authorityReference))reasons.push("authoritative_creator_state_required");
 if(!s(envelope.snapshotReference)||!s(envelope.capturedAt))reasons.push("snapshot_reference_and_time_required");
 const expected=digestPayload(fingerprintPayload(envelope));
 if(!/^[a-f0-9]{64}$/i.test(s(envelope.snapshotFingerprint))||s(envelope.snapshotFingerprint)!==expected)reasons.push("turn_context_snapshot_fingerprint_mismatch");
 if(reasons.length)return{verified:false,reasons};
 if(typeof deps.readAuthoritativeRevision!=="function")return{verified:false,reasons:["trusted_authoritative_revision_reader_required"]};
 if(typeof deps.readAuthoritativeCreatorState!=="function")return{verified:false,reasons:["trusted_authoritative_creator_state_reader_required"]};
 let revision,state;try{[revision,state]=await Promise.all([deps.readAuthoritativeRevision({projectId:envelope.projectId,creatorSessionId:envelope.creatorSessionId}),deps.readAuthoritativeCreatorState({projectId:envelope.projectId,creatorSessionId:envelope.creatorSessionId})]);}catch{return{verified:false,reasons:["turn_context_authority_read_failed"]};}
 if(n(revision?.revision)!==authoritative||s(revision?.reference)!==s(envelope.revision.authorityReference))return{verified:false,reasons:["turn_context_revision_authority_mismatch"]};
 if(n(state?.generation)!==n(envelope.creatorState.generation)||s(state?.fingerprint)!==s(envelope.creatorState.fingerprint)||s(state?.authorityReference)!==s(envelope.creatorState.authorityReference))return{verified:false,reasons:["turn_context_creator_state_authority_mismatch"]};
 if(state?.snapshotReference&&s(state.snapshotReference)!==s(envelope.snapshotReference))return{verified:false,reasons:["turn_context_snapshot_reference_mismatch"]};
 return{verified:true,reasons:[],snapshotFingerprint:expected,projectId:s(envelope.projectId)||null,creatorSessionId:s(envelope.creatorSessionId)||null,revision:authoritative,revisionAuthorityReference:s(envelope.revision.authorityReference),creatorState:clone(envelope.creatorState),snapshotReference:s(envelope.snapshotReference)};
}

export{MOVIE_MENTOR_TURN_CONTEXT_VERSION,MOVIE_MENTOR_TURN_CONTEXT_DOMAIN,MOVIE_MENTOR_TURN_CONTEXT_SCHEMA,MOVIE_MENTOR_TURN_CONTEXT_AUTHORITY,createTurnContextEnvelope,verifyAuthoritativeTurnContext};
export default verifyAuthoritativeTurnContext;
