import assert from "node:assert/strict";
import { fingerprint } from "../ai/MovieMentorJourneyRecoveryEnvelope.js";
import { applyMovieMentorJourneyRecoveryTransition } from "../ai/MovieMentorJourneyRecoveryTransition.js";
import { createMovieMentorJourneyRecoveryPublicationBoundary } from "../ai/MovieMentorJourneyRecoveryPublicationBoundary.js";

console.log("5A.27 — Journey recovery publication write authority torture");
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const project=projectId=>({projectId,identityDomain:"iband.movie-mentor.project",identitySchema:1,identityIssuance:"secure-web-crypto",legacy:false});
function envelope(projectId="recovery-project"){
  const journey={projectId,currentStageId:"story",currentTaskId:"truth",progression:{schemaVersion:1,revision:2,lastCommittedOperation:null,committedOperations:[]},decisions:[]};
  const authorityRecord={domain:"iband.movie-mentor.journey-authority",schema:1,project:project(projectId),authority:{generation:4,createdAt:"2026-09-05T20:00:00.000Z",updatedAt:"2026-09-05T20:00:00.000Z"},bootstrap:{status:"created-native",source:"native",sourceJourneyRevision:0,bootstrappedAt:"2026-09-05T20:00:00.000Z"},journey,journeyFingerprint:fingerprint(journey),recommendations:[],projection:{lastProjectedAuthorityGeneration:4,authoritativeCreatorProjectionRevision:2,projectedAt:"2026-09-05T20:00:00.000Z"}};
  const e={domain:"iband.movie-mentor.journey-authority-recovery-envelope",schema:1,lineageId:"lineage-1",project:project(projectId),authorityGeneration:4,progressionRevision:2,journeyFingerprint:authorityRecord.journeyFingerprint,authoritySnapshotFingerprint:fingerprint(authorityRecord),authorityRecord};
  e.envelopeFingerprint=fingerprint({domain:e.domain,schema:e.schema,lineageId:e.lineageId,project:e.project,authorityGeneration:e.authorityGeneration,progressionRevision:e.progressionRevision,journeyFingerprint:e.journeyFingerprint,authoritySnapshotFingerprint:e.authoritySnapshotFingerprint,authorityRecord:e.authorityRecord});return e;
}
function memoryRecovery({beforeWrite=async()=>{}}={}){let record=null,writes=0;return{readRecovery:async()=>{if(!record){const e=new Error("missing");e.code="MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_FOUND";throw e;}return clone(record);},writeRecovery:async(next,{expectedRecoveryRevision})=>{await beforeWrite();writes++;const current=record?.recoveryRevision||0;if(current!==expectedRecoveryRevision){const e=new Error("conflict");e.code="MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT";throw e;}record=clone(next);return clone(record);},counts:()=>({writes}),get:()=>clone(record)};}
const owned=()=>Object.freeze({authorized:true,principalId:"creator-1",projectId:"recovery-project",ownershipRef:"ownership:recovery-project",authenticationSource:"test",authorizationSource:"current-owner"});
const revoked=()=>{const e=new Error("revoked");e.code="MOVIE_MENTOR_AUTH_REVOKED";throw e;};
function makeBoundary(requestAuthority,recovery){return createMovieMentorJourneyRecoveryPublicationBoundary({requestAuthority,applyRecoveryTransition:input=>applyMovieMentorJourneyRecoveryTransition(input,recovery)});}
async function expectCode(code,fn){let thrown=null;try{await fn();}catch(e){thrown=e;}assert.ok(thrown,`Expected ${code}`);assert.equal(thrown.code,code);}

// Admission authority is historical by the time the irreversible recovery write occurs.
// Revocation after admission but before write must produce zero durable writes.
{
  let calls=0,revokedNow=false;
  const requestAuthority={authorize:async()=>{calls++;return revokedNow?revoked():owned();}};
  const recovery=memoryRecovery({beforeWrite:async()=>{revokedNow=true;}});
  const boundary=makeBoundary(requestAuthority,recovery);
  await expectCode("MOVIE_MENTOR_AUTH_REVOKED",()=>boundary.publish({request:{headers:{authorization:"Bearer owner"}},projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope()}));
  assert.ok(calls>=2,"publication must re-earn current ownership at the irreversible durable-write boundary");
  assert.equal(recovery.counts().writes,0,"revoked ownership before durable recovery publication must write zero checkpoints");
  assert.equal(recovery.get(),null);
}

// Positive path: current ownership survives admission and the write boundary; exactly one checkpoint is written.
{
  let calls=0;
  const requestAuthority={authorize:async()=>{calls++;return owned();}};
  const recovery=memoryRecovery();
  const boundary=makeBoundary(requestAuthority,recovery);
  const result=await boundary.publish({request:{headers:{authorization:"Bearer owner"}},projectId:"recovery-project",expectedRecoveryRevision:0,envelope:envelope()});
  assert.equal(result.status,"published");
  assert.ok(calls>=2,"positive publication must independently prove admission and current write authority");
  assert.equal(recovery.counts().writes,1);
}

console.log("✓ admission authority cannot authorize a later durable recovery write after revocation");
console.log("✓ current ownership is independently re-earned immediately before the irreversible recovery checkpoint write");
console.log("LAW: AUTHORIZATION MAY ADMIT THE REQUEST. IT MAY NOT AUTHORIZE A LATER DURABLE WRITE AFTER OWNERSHIP REALITY CHANGES.");
console.log("5A.27 Journey recovery publication write authority torture: GREEN");
