import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";

console.log("5A.32 — Journey recovery in-flight ownership generation re-exposure authority");

function makeResponse(){return{statusCode:200,body:null,exposures:0,forbidden:0,status(code){this.statusCode=code;return this;},json(body){this.body=body;if(body?.success===true)this.exposures+=1;if(this.statusCode===403&&body?.success===false)this.forbidden+=1;return this;}};}

async function run({advanceOwnershipRevisionBeforeExposure=false}={}){
 let ownershipRevision=7;
 let publicationCompleted=false;
 let authorizeCalls=0;
 const requestAuthority={async authorize(){authorizeCalls+=1;return{authorized:true,principalId:"creator-A",projectId:"project-1",ownershipRef:"ownership-A",ownershipRevision,authenticationSource:"adversarial-verifier",authorizationSource:"adversarial-verifier"};}};
 const publicationBoundary={async publish(){publicationCompleted=true;return{status:"published",recoveryStatus:"created",projectId:"project-1",principalId:"creator-A",ownershipRef:"ownership-A",ownershipRevision:7,authenticationSource:"adversarial-verifier",authorizationSource:"adversarial-verifier",recoveryRevision:1,recoveryGeneration:1,recoveryReference:"recovery-1",recoveryFingerprint:"recovery-fp-1",lineageId:"lineage-1",authorityGeneration:4,progressionRevision:2,envelopeFingerprint:"env-fp",capturedAt:"2026-09-06T20:00:00.000Z"};}};
 const router=createMovieMentorJourneyRecoveryExpressRouter({
  verifyCredential:async()=>({}),expectedIssuer:"issuer",expectedAudience:"audience",
  createRequestAuthority:()=>requestAuthority,
  createPublicationBoundary:()=>publicationBoundary,
  createHttpAdapter:({publicationBoundary})=>({async handle({request,projectId}){const publication=await publicationBoundary.publish({request,projectId,expectedRecoveryRevision:0,envelope:{}});assert.equal(publication.principalId,"creator-A");assert.equal(publication.ownershipRef,"ownership-A");assert.equal(publication.ownershipRevision,7,"adversarial verifier must bind the result to ownership revision 7");if(advanceOwnershipRevisionBeforeExposure&&publicationCompleted)ownershipRevision=8;return{statusCode:200,authorityBinding:{principalId:publication.principalId,projectId:publication.projectId,ownershipRef:publication.ownershipRef,ownershipRevision:publication.ownershipRevision},body:{success:true,status:publication.recoveryStatus,projectId:publication.projectId,recoveryRevision:publication.recoveryRevision,recoveryGeneration:publication.recoveryGeneration}};}})
 });
 const layer=router.stack.find(entry=>entry.route?.path==="/:projectId/recovery");assert.ok(layer,"recovery route must exist");const res=makeResponse();await layer.route.stack[0].handle({params:{projectId:"project-1"},body:{expectedRecoveryRevision:0,envelope:{}},headers:{authorization:"Bearer creator-A-token"}},res);return{res,authorizeCalls};
}

{const{res,authorizeCalls}=await run({advanceOwnershipRevisionBeforeExposure:false});assert.equal(res.exposures,1,"unchanged ownership generation must allow exactly one valid recovery exposure");assert.equal(res.statusCode,200);assert.equal(authorizeCalls,1,"successful exposure must ask current request authority at the final router boundary");console.log("✓ unchanged ownership generation remains exposable");}
{const{res,authorizeCalls}=await run({advanceOwnershipRevisionBeforeExposure:true});assert.equal(res.exposures,0,"same principal/project/reference under a later ownership revision must expose zero successful responses from the earlier authority generation");assert.equal(res.statusCode,403,"ownership generation mismatch must fail creator-facing exposure closed");assert.equal(res.forbidden,1,"ownership generation mismatch must emit the sanitized forbidden response");assert.equal(authorizeCalls,1,"final exposure must reauthorize and compare the current ownership generation");console.log("✓ later ownership revision cannot resurrect an earlier authority universe");}

console.log("PASS Journey recovery in-flight ownership generation re-exposure authority.");
console.log("LAW: identity equality is not authority-generation equality; current ownership revision must match the revision that earned the result.");
