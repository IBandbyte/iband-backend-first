import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";

console.log("5A.31 — Journey recovery in-flight ownership transfer re-exposure authority");

function makeResponse(){return{statusCode:200,body:null,exposures:0,forbidden:0,status(code){this.statusCode=code;return this;},json(body){this.body=body;if(body?.success===true)this.exposures+=1;if(this.statusCode===403&&body?.success===false)this.forbidden+=1;return this;}};}

async function run({transferBeforeExposure=false}={}){
 let currentOwner={principalId:"creator-A",ownershipRef:"ownership-A"};
 let publicationCompleted=false;
 let authorizeCalls=0;
 const requestAuthority={async authorize(){authorizeCalls+=1;return{authorized:true,principalId:currentOwner.principalId,projectId:"project-1",ownershipRef:currentOwner.ownershipRef,ownershipRevision:currentOwner.ownershipRef==="ownership-A"?7:8,authenticationSource:"adversarial-verifier",authorizationSource:"adversarial-verifier"};}};
 const publicationBoundary={async publish(){publicationCompleted=true;return{status:"published",recoveryStatus:"created",projectId:"project-1",principalId:"creator-A",ownershipRef:"ownership-A",authenticationSource:"adversarial-verifier",authorizationSource:"adversarial-verifier",recoveryRevision:1,recoveryGeneration:1,recoveryReference:"recovery-1",recoveryFingerprint:"recovery-fp-1",lineageId:"lineage-1",authorityGeneration:4,progressionRevision:2,envelopeFingerprint:"env-fp",capturedAt:"2026-09-06T18:00:00.000Z"};}};
 const router=createMovieMentorJourneyRecoveryExpressRouter({
  verifyCredential:async()=>({}),expectedIssuer:"issuer",expectedAudience:"audience",
  createRequestAuthority:()=>requestAuthority,
  createPublicationBoundary:()=>publicationBoundary,
  createHttpAdapter:({publicationBoundary})=>({async handle({request,projectId}){const publication=await publicationBoundary.publish({request,projectId,expectedRecoveryRevision:0,envelope:{}});assert.equal(publication.principalId,"creator-A","adversarial verifier must begin in creator A authority universe");assert.equal(publication.ownershipRef,"ownership-A","adversarial verifier must preserve creator A ownership provenance through publication");if(transferBeforeExposure&&publicationCompleted)currentOwner={principalId:"creator-B",ownershipRef:"ownership-B"};return{statusCode:200,body:{success:true,status:publication.recoveryStatus,projectId:publication.projectId,recoveryRevision:publication.recoveryRevision,recoveryGeneration:publication.recoveryGeneration}};}})
 });
 const layer=router.stack.find(entry=>entry.route?.path==="/:projectId/recovery");assert.ok(layer,"recovery route must exist");const res=makeResponse();await layer.route.stack[0].handle({params:{projectId:"project-1"},body:{expectedRecoveryRevision:0,envelope:{}},headers:{authorization:"Bearer creator-A-token"}},res);return{res,authorizeCalls};
}

{const{res,authorizeCalls}=await run({transferBeforeExposure:false});assert.equal(res.exposures,1,"unchanged creator ownership must allow exactly one valid recovery exposure");assert.equal(res.statusCode,200);assert.equal(authorizeCalls,1,"successful exposure must ask current request authority at the final router boundary");console.log("✓ unchanged creator authority universe remains exposable");}
{const{res,authorizeCalls}=await run({transferBeforeExposure:true});assert.equal(res.exposures,0,"ownership transfer after creator A publication but before HTTP emission must expose zero successful responses to creator A's in-flight request");assert.equal(res.statusCode,403,"cross-principal ownership transfer must fail creator A's in-flight exposure closed");assert.equal(res.forbidden,1,"cross-principal ownership transfer must emit the sanitized forbidden response");assert.equal(authorizeCalls,1,"final exposure must reauthorize and reject a different current ownership universe");console.log("✓ in-flight ownership transfer cannot replace creator A provenance with creator B authority at final exposure");}

console.log("PASS Journey recovery in-flight ownership transfer re-exposure authority.");
console.log("LAW: current authority must match the authority universe that earned the result; ownership transfer may authorize the new owner, but it may not retroactively authorize the old owner's in-flight response.");
