import assert from "node:assert/strict";
import {
  classifyMovieMentorJourneyRecoveryHttpError,
  createMovieMentorJourneyRecoveryHttpTransportAdapter,
} from "../ai/MovieMentorJourneyRecoveryHttpTransportAdapter.js";

function request(body={},headers={authorization:"Bearer test"}){return{body,headers};}
function publicationBoundary({result=null,error=null,capture=null}={}){return{publish:async(input)=>{if(capture)capture(input);if(error)throw error;return result||{recoveryStatus:"created",projectId:"project-1",recoveryRevision:1,recoveryGeneration:1,lineageId:"lineage-1",authorityGeneration:4,progressionRevision:2,envelopeFingerprint:"env-fp",capturedAt:"2026-08-28T00:00:00.000Z",principalId:"principal-owner",ownershipRef:"ownership:project-1",recoveryReference:"secret-ref",recoveryFingerprint:"secret-recovery-fingerprint"};}};}
function coded(code,message="SENSITIVE INTERNAL DETAIL"){const e=new Error(message);e.code=code;e.reason="secret-reason";e.field="secret-field";return e;}

// Success: HTTP returns only publication coordinates needed by client; internal principal/ownership/store refs stay hidden.
{
 let seen=null;
 const adapter=createMovieMentorJourneyRecoveryHttpTransportAdapter({publicationBoundary:publicationBoundary({capture:v=>seen=v})});
 const req=request({expectedRecoveryRevision:0,envelope:{domain:"test"},principalId:"forged-owner",ownerId:"forged-owner",admin:true});
 const response=await adapter.handle({request:req,projectId:"project-1"});
 assert.equal(response.statusCode,200);assert.equal(response.body.success,true);assert.equal(response.body.projectId,"project-1");assert.equal(response.body.recoveryRevision,1);
 assert.equal(seen.projectId,"project-1");assert.equal(seen.expectedRecoveryRevision,0);assert.equal(seen.request,req);assert.deepEqual(seen.envelope,{domain:"test"});
 for(const forbidden of ["principalId","ownershipRef","authenticationSource","authorizationSource","recoveryReference","recoveryFingerprint"])assert.equal(Object.hasOwn(response.body,forbidden),false);
 assert.ok(Object.isFrozen(response));assert.ok(Object.isFrozen(response.body));
}

// Body project selection is forbidden; the eventual route must select projectId outside the body.
{
 let called=0;const adapter=createMovieMentorJourneyRecoveryHttpTransportAdapter({publicationBoundary:{publish:async()=>{called++;}}});
 const response=await adapter.handle({request:request({projectId:"victim-project",expectedRecoveryRevision:0,envelope:{}}),projectId:"owner-project"});
 assert.equal(response.statusCode,400);assert.equal(called,0);
}

// Missing route-selected project, malformed body/revision/envelope all fail before publication authority.
for(const test of [
 {request:request({expectedRecoveryRevision:0,envelope:{}}),projectId:null},
 {request:{body:null},projectId:"project-1"},
 {request:request({expectedRecoveryRevision:-1,envelope:{}}),projectId:"project-1"},
 {request:request({expectedRecoveryRevision:0,envelope:null}),projectId:"project-1"},
]){
 let called=0;const adapter=createMovieMentorJourneyRecoveryHttpTransportAdapter({publicationBoundary:{publish:async()=>{called++;}}});
 const response=await adapter.handle(test);assert.equal(response.statusCode,400);assert.equal(response.body.code,"MOVIE_MENTOR_RECOVERY_INVALID_REQUEST");assert.equal(called,0);
}

// Authentication and ownership failures are sanitized and correctly classified.
for(const [code,status,publicCode] of [
 ["MOVIE_MENTOR_AUTH_CREDENTIAL_REQUIRED",401,"MOVIE_MENTOR_RECOVERY_UNAUTHENTICATED"],
 ["MOVIE_MENTOR_AUTH_EXPIRED",401,"MOVIE_MENTOR_RECOVERY_UNAUTHENTICATED"],
 ["MOVIE_MENTOR_AUTH_REVOKED",401,"MOVIE_MENTOR_RECOVERY_UNAUTHENTICATED"],
 ["MOVIE_MENTOR_AUTH_ISSUER_MISMATCH",401,"MOVIE_MENTOR_RECOVERY_UNAUTHENTICATED"],
 ["MOVIE_MENTOR_AUTH_AUDIENCE_MISMATCH",401,"MOVIE_MENTOR_RECOVERY_UNAUTHENTICATED"],
 ["MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED",403,"MOVIE_MENTOR_RECOVERY_FORBIDDEN"],
]){
 const adapter=createMovieMentorJourneyRecoveryHttpTransportAdapter({publicationBoundary:publicationBoundary({error:coded(code)})});
 const response=await adapter.handle({request:request({expectedRecoveryRevision:0,envelope:{}}),projectId:"project-1"});
 assert.equal(response.statusCode,status);assert.equal(response.body.code,publicCode);assert.equal(JSON.stringify(response).includes("SENSITIVE INTERNAL DETAIL"),false);assert.equal(JSON.stringify(response).includes("secret-reason"),false);
}

// Recovery-state conflicts remain conflicts, without leaking split-brain/lineage internals.
for(const code of ["MOVIE_MENTOR_JOURNEY_RECOVERY_REVISION_CONFLICT","MOVIE_MENTOR_JOURNEY_RECOVERY_ROLLBACK_REJECTED","MOVIE_MENTOR_JOURNEY_RECOVERY_SPLIT_BRAIN","MOVIE_MENTOR_JOURNEY_RECOVERY_LINEAGE_CONFLICT"]){
 const response=classifyMovieMentorJourneyRecoveryHttpError(coded(code));assert.equal(response.statusCode,409);assert.equal(response.body.code,"MOVIE_MENTOR_RECOVERY_CONFLICT");assert.equal(JSON.stringify(response).includes(code),false);
}

// Envelope/input invalidity maps to generic 400; store/config failures map to 503; unknown failures map to generic 500.
for(const code of ["MOVIE_MENTOR_JOURNEY_RECOVERY_ENVELOPE_INVALID","MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORITY_INJECTION"]){const r=classifyMovieMentorJourneyRecoveryHttpError(coded(code));assert.equal(r.statusCode,400);assert.equal(r.body.code,"MOVIE_MENTOR_RECOVERY_INVALID_REQUEST");}
for(const code of ["MOVIE_MENTOR_JOURNEY_RECOVERY_STORE_NOT_CONFIGURED","MOVIE_MENTOR_JOURNEY_RECOVERY_STORE_UNAVAILABLE"]){const r=classifyMovieMentorJourneyRecoveryHttpError(coded(code));assert.equal(r.statusCode,503);assert.equal(r.body.code,"MOVIE_MENTOR_RECOVERY_UNAVAILABLE");}
{
 const r=classifyMovieMentorJourneyRecoveryHttpError(new Error("database password and stack trace"));assert.equal(r.statusCode,500);assert.equal(r.body.code,"MOVIE_MENTOR_RECOVERY_INTERNAL_ERROR");assert.equal(JSON.stringify(r).includes("password"),false);
}

console.log("PASS Movie Mentor Journey recovery HTTP transport adapter torture.");
console.log("- HTTP project identity is server-selected, never body-selected");
console.log("- body identity/admin claims are irrelevant to publication authority");
console.log("- malformed requests fail before publication authority is touched");
console.log("- authentication, authorization, CAS and recovery conflicts map to stable safe HTTP classes");
console.log("- internal principal, ownership, recovery references and error details do not leak");
console.log("- no Express route is created or mounted by this adapter");
