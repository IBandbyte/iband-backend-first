import assert from "node:assert/strict";
import { fingerprint } from "../ai/MovieMentorJourneyRecoveryEnvelope.js";
import { applyMovieMentorJourneyRecoveryTransition } from "../ai/MovieMentorJourneyRecoveryTransition.js";
import { createMovieMentorJourneyRecoveryPublicationBoundary } from "../ai/MovieMentorJourneyRecoveryPublicationBoundary.js";

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function project(projectId="recovery-project"){return{projectId,identityDomain:"iband.movie-mentor.project",identitySchema:1,identityIssuance:"secure-web-crypto",legacy:false};}
function authority({projectId="recovery-project",generation=4,revision=2,label="truth",projectionRevision=revision}={}){const journey={projectId,currentStageId:"story",currentTaskId:label,progression:{schemaVersion:1,revision,lastCommittedOperation:null,committedOperations:[]},decisions:[]};return{domain:"iband.movie-mentor.journey-authority",schema:1,project:project(projectId),authority:{generation,createdAt:"2026-08-28T20:00:00.000Z",updatedAt:"2026-08-28T20:00:00.000Z"},bootstrap:{status:"created-native",source:"native",sourceJourneyRevision:0,bootstrappedAt:"2026-08-28T20:00:00.000Z"},journey,journeyFingerprint:fingerprint(journey),recommendations:[],projection:{lastProjectedAuthorityGeneration:generation,authoritativeCreatorProjectionRevision:projectionRevision,projectedAt:"2026-08-28T20:00:00.000Z"}};}
function envelope({projectId="recovery-project",lineageId="lineage-1",generation=4,revision=2,label="truth",projectionRevision=revision}={}){const authorityRecord=authority({projectId,generation,revision,label,projectionRevision});const e={domain:"iband.movie-mentor.journey-authority-recovery-envelope",schema:1,lineageId,project:project(projectId),authorityGeneration:generation,progressionRevision:revision,journeyFingerprint:authorityRecord.journeyFingerprint,authoritySnapshotFingerprint:fingerprint(authorityRecord),authorityRecord};e.envelopeFingerprint=fingerprint({domain:e.domain,schema:e.schema,lineageId:e.lineageId,project:e.project,authorityGeneration:e.authorityGeneration,progressionRevision:e.progressionRevision,journeyFingerprint:e.journeyFingerprint,authoritySnapshotFingerprint:e.authoritySnapshotFingerprint,authorityRecord:e.authorityRecord});return e;}
function memoryRecovery(){let record=null,writes=0,reads=0;return{readRecovery:async({projectId})=>{reads++;if(!record||record.projectId!==projectId){const e=new Error("missing");e.code="MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_FOUND";throw e;}return clone(record);},writeRecovery:async(next,{expectedRecoveryRevision})=>{writes++;const current=record?.recoveryRevision||0;if(current!==expectedRecoveryRevision){const e=new Error("conflict");e.code="MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT";throw e;}record=clone(next);return clone(record);},get:()=>clone(record),counts:()=>({reads,writes})};}
function authorizedRequestAuthority({principalId="principal-owner",projectId="recovery-project"}={}){return{authorize:async()=>Object.freeze({authorized:true,principalId,projectId,ownershipRef:`ownership:${projectId}`,authenticationSource:"deterministic-credential-verifier",authorizationSource:"movie-mentor-project-ownership-registry"})};}
function deniedRequestAuthority(code="MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED"){return{authorize:async()=>{const e=new Error("denied");e.code=code;throw e;}};}
function boundary({requestAuthority,recovery}){return createMovieMentorJourneyRecoveryPublicationBoundary({requestAuthority,applyRecoveryTransition:(input)=>applyMovieMentorJourneyRecoveryTransition(input,recovery)});}
async function expectCode(code,fn){let thrown=null;try{await fn();}catch(e){thrown=e;}assert.ok(thrown,`Expected ${code}`);assert.equal(thrown.code,code);}

// Legitimate owner: authorization precedes one recovery write and publication returns server recovery coordinates.
{
 const recovery=memoryRecovery(),b=boundary({requestAuthority:authorizedRequestAuthority(),recovery});
 const result=await b.publish({request:{headers:{authorization:"Bearer owner"}},projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope()});
 assert.equal(result.status,"published");assert.equal(result.recoveryStatus,"created");assert.equal(result.principalId,"principal-owner");assert.equal(result.projectId,"recovery-project");assert.equal(result.recoveryRevision,1);assert.equal(recovery.counts().writes,1);assert.ok(recovery.get());assert.ok(Object.isFrozen(result));
}

// Critical cross-boundary law: a perfect envelope grants zero write authority to a denied/foreign principal.
for(const code of ["MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED","MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED","MOVIE_MENTOR_AUTH_EXPIRED","MOVIE_MENTOR_AUTH_REVOKED"]){
 const recovery=memoryRecovery(),b=boundary({requestAuthority:deniedRequestAuthority(code),recovery});
 await expectCode(code,()=>b.publish({request:{body:{principalId:"principal-owner",ownerId:"principal-owner",admin:true}},projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope()}));
 assert.deepEqual(recovery.counts(),{reads:0,writes:0});assert.equal(recovery.get(),null);
}

// Authorization evidence itself must bind the same server-selected project before transition is reachable.
{
 const recovery=memoryRecovery(),b=boundary({requestAuthority:authorizedRequestAuthority({projectId:"other-project"}),recovery});
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_PUBLICATION_AUTHORIZATION_INVALID",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope()}));
 assert.deepEqual(recovery.counts(),{reads:0,writes:0});
}

// Valid owner + malformed/tampered/wrong-project envelope reaches transition but never writes.
{
 const recovery=memoryRecovery(),b=boundary({requestAuthority:authorizedRequestAuthority(),recovery});
 const bad=envelope();bad.authorityRecord.journey.currentTaskId="zorg-tamper";
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_ENVELOPE_INVALID",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:0,envelope:bad}));
 assert.equal(recovery.counts().writes,0);
}
{
 const recovery=memoryRecovery(),b=boundary({requestAuthority:authorizedRequestAuthority(),recovery});
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_ENVELOPE_INVALID",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope({projectId:"other-project"})}));
 assert.equal(recovery.counts().writes,0);
}

// CAS, idempotence, rollback, split-brain and lineage conflict survive the authorization wrapper unchanged.
{
 const recovery=memoryRecovery(),b=boundary({requestAuthority:authorizedRequestAuthority(),recovery});
 const e1=envelope({generation:4,revision:2,label:"n2"});
 const first=await b.publish({projectId:"recovery-project",expectedRecoveryRevision:0,envelope:e1});assert.equal(first.recoveryStatus,"created");
 const idem=await b.publish({projectId:"recovery-project",expectedRecoveryRevision:1,envelope:e1});assert.equal(idem.recoveryStatus,"idempotent");assert.equal(recovery.counts().writes,1);
 const e2=envelope({generation:5,revision:3,label:"n3"});
 const advanced=await b.publish({projectId:"recovery-project",expectedRecoveryRevision:1,envelope:e2});assert.equal(advanced.recoveryStatus,"advanced");assert.equal(advanced.recoveryRevision,2);
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:1,envelope:envelope({generation:6,revision:4,label:"stale"})}));
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_ROLLBACK_REJECTED",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:2,envelope:e1}));
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_SPLIT_BRAIN",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:2,envelope:envelope({generation:5,revision:3,label:"evil",projectionRevision:99})}));
 await expectCode("MOVIE_MENTOR_JOURNEY_RECOVERY_LINEAGE_CONFLICT",()=>b.publish({projectId:"recovery-project",expectedRecoveryRevision:2,envelope:envelope({lineageId:"zorg-lineage",generation:6,revision:4})}));
}

// Client cannot inject backend-owned recovery coordinates through the publication API shape.
{
 let seen=null;const b=createMovieMentorJourneyRecoveryPublicationBoundary({requestAuthority:authorizedRequestAuthority(),applyRecoveryTransition:async(input)=>{seen=clone(input);return{status:"created",projectId:"recovery-project",recoveryRevision:1,recoveryGeneration:1,recoveryReference:"r",recoveryFingerprint:"f",lineageId:"lineage-1",authorityGeneration:4,progressionRevision:2,envelopeFingerprint:"ef",capturedAt:"2026-08-28T20:00:00.000Z"};}});
 await b.publish({projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope(),recoveryRevision:999,recoveryGeneration:999,recoveryReference:"zorg"});
 assert.deepEqual(Object.keys(seen).sort(),["envelope","expectedRecoveryRevision","projectId"]);
}

console.log("PASS Movie Mentor authorized Journey recovery publication boundary torture.");
console.log("- perfect recovery evidence grants zero store access without authenticated project authority");
console.log("- denied, missing, expired and revoked authority produce zero recovery reads and zero writes");
console.log("- authorization project binding is checked before recovery transition");
console.log("- envelope validation, CAS, idempotence, rollback, split-brain and lineage laws remain sovereign in the recovery transition");
console.log("- publication does not forward client-shaped backend recovery authority fields");
