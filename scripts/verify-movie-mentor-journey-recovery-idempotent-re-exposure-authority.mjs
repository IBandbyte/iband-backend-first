import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";

console.log("5A.29 — Journey recovery idempotent historical re-exposure authority torture");

function makeResponse(){return{statusCode:200,body:null,exposures:0,forbidden:0,status(code){this.statusCode=code;return this;},json(body){this.body=body;if(body?.success===true)this.exposures+=1;if(this.statusCode===403&&body?.success===false)this.forbidden+=1;return this;}};}

async function run({revokeAfterIdempotentResolution=false}={}){
 let ownershipCurrent=true,idempotentResolved=false,authorizeCalls=0;
 const requestAuthority={async authorize(){authorizeCalls+=1;return ownershipCurrent?{authorized:true,principalId:"creator-1",projectId:"project-1",ownershipRef:"ownership-A",ownershipRevision:7,authenticationSource:"torture",authorizationSource:"torture"}:{authorized:false,principalId:"creator-1",projectId:"project-1"};}};
 const publicationBoundary={async publish(){idempotentResolved=true;return{recoveryStatus:"idempotent",projectId:"project-1",recoveryRevision:7,recoveryGeneration:7,recoveryReference:"recovery-7",recoveryFingerprint:"recovery-fp-7",lineageId:"lineage-1",authorityGeneration:11,progressionRevision:19,envelopeFingerprint:"fingerprint-existing-checkpoint",capturedAt:"2026-09-05T23:00:00.000Z"};}};
 const router=createMovieMentorJourneyRecoveryExpressRouter({
  verifyCredential:async()=>({}),expectedIssuer:"issuer",expectedAudience:"audience",
  createRequestAuthority:()=>requestAuthority,
  createPublicationBoundary:()=>publicationBoundary,
  createHttpAdapter:({publicationBoundary})=>({async handle({request,projectId}){const publication=await publicationBoundary.publish({request,projectId,expectedRecoveryRevision:7,envelope:{}});assert.equal(publication.recoveryStatus,"idempotent","torture must exercise historical idempotent recovery resolution");if(revokeAfterIdempotentResolution&&idempotentResolved)ownershipCurrent=false;return{statusCode:200,body:{success:true,status:publication.recoveryStatus,projectId:publication.projectId,recoveryRevision:publication.recoveryRevision,recoveryGeneration:publication.recoveryGeneration}};}})
 });
 const layer=router.stack.find(entry=>entry.route?.path==="/:projectId/recovery");assert.ok(layer,"recovery route must exist");const res=makeResponse();await layer.route.stack[0].handle({params:{projectId:"project-1"},body:{expectedRecoveryRevision:7,envelope:{}},headers:{authorization:"Bearer token"}},res);return{res,authorizeCalls};
}

{const{res,authorizeCalls}=await run({revokeAfterIdempotentResolution:false});assert.equal(res.exposures,1,"current ownership must allow exactly one valid idempotent recovery exposure");assert.equal(res.statusCode,200);assert.equal(authorizeCalls,1,"successful idempotent exposure must ask current request authority at the final router boundary");console.log("✓ valid idempotent recovery remains exposable while current ownership survives");}
{const{res,authorizeCalls}=await run({revokeAfterIdempotentResolution:true});assert.equal(res.exposures,0,"ownership revoked after idempotent historical recovery resolution but before HTTP emission must expose zero successful recovery responses");assert.equal(res.statusCode,403,"revoked idempotent historical recovery exposure must fail closed");assert.equal(res.forbidden,1,"revoked idempotent historical recovery must emit the sanitized forbidden response");assert.equal(authorizeCalls,1,"idempotent history must independently re-earn current ownership at exposure");console.log("✓ idempotent historical recovery cannot borrow old ownership authority for later creator-facing exposure");}
console.log("PASS Journey recovery idempotent historical re-exposure authority torture.");
console.log("LAW: idempotent history may preserve recovery reality; current ownership must independently authorize creator-facing re-exposure.");
