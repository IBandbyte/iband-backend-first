import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryPublicationBoundary } from "../ai/MovieMentorJourneyRecoveryPublicationBoundary.js";

console.log("5A.27 — Journey recovery current-write authority torture");

const projectId = "recovery-project";
const initialAuthority = Object.freeze({authorized:true,principalId:"creator-1",projectId,ownershipRef:`ownership:${projectId}:1`,authenticationSource:"test",authorizationSource:"test-current-owner"});
function requestAuthorityWithRevocation(){let calls=0,revoked=false;return{revoke(){revoked=true;},get calls(){return calls;},async authorize(){calls+=1;if(revoked){const error=new Error("ownership revoked");error.code="MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED";throw error;}return initialAuthority;}};}
function recoveryResult(){return Object.freeze({status:"created",projectId,recoveryRevision:1,recoveryGeneration:1,recoveryReference:"recovery-1",recoveryFingerprint:"fingerprint-1",lineageId:"lineage-1",authorityGeneration:1,progressionRevision:1,envelopeFingerprint:"envelope-1",capturedAt:"2026-09-06T00:00:00.000Z"});}
async function expectDenied(fn){let thrown=null;try{await fn();}catch(error){thrown=error;}assert.ok(thrown,"expected current ownership revocation to fail closed");assert.equal(thrown.code,"MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED");}

// Admission is valid. The injected transition revokes ownership before returning.
// A publication boundary that only authorizes at admission will still publish.
// The required boundary must ask current ownership again before accepting the
// irreversible transition result as an authorized recovery publication.
{
 const requestAuthority=requestAuthorityWithRevocation();let transitions=0;
 const boundary=createMovieMentorJourneyRecoveryPublicationBoundary({requestAuthority,applyRecoveryTransition:async()=>{transitions+=1;requestAuthority.revoke();return recoveryResult();}});
 await expectDenied(()=>boundary.publish({request:{headers:{authorization:"Bearer creator"}},projectId,expectedRecoveryRevision:0,envelope:{test:true}}));
 assert.equal(transitions,1,"the race must revoke after admission while transition is in flight");
 assert.ok(requestAuthority.calls>=2,"recovery publication must re-earn current ownership after the transition before publication authority survives");
}

// Positive current ownership survives both admission and the post-transition boundary.
{
 const requestAuthority=requestAuthorityWithRevocation();let transitions=0;
 const boundary=createMovieMentorJourneyRecoveryPublicationBoundary({requestAuthority,applyRecoveryTransition:async()=>{transitions+=1;return recoveryResult();}});
 const result=await boundary.publish({request:{headers:{authorization:"Bearer creator"}},projectId,expectedRecoveryRevision:0,envelope:{test:true}});
 assert.equal(result.status,"published");assert.equal(transitions,1);assert.ok(requestAuthority.calls>=2,"positive publication must also re-earn current ownership after transition");
}

console.log("LAW: admission authority may not authorize a later recovery publication after current project ownership has been revoked.");
console.log("5A.27 Journey recovery current-write authority torture: GREEN");
