import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";

console.log("5A.28 — Journey recovery HTTP re-exposure authority torture");

function makeResponse(){
  return { statusCode:200, body:null, exposures:0, status(code){this.statusCode=code;return this;}, json(body){this.body=body;if(body?.success===true)this.exposures+=1;return this;} };
}

async function run({revokeAfterPublication=false}={}){
  let ownershipCurrent=true;
  let publicationCompleted=false;
  let authorizeCalls=0;
  const requestAuthority={
    async authorize(){
      authorizeCalls+=1;
      return ownershipCurrent
        ? {authorized:true,principalId:"creator-1",projectId:"project-1",ownershipRef:"ownership-A",ownershipRevision:4,authenticationSource:"torture",authorizationSource:"torture"}
        : {authorized:false,principalId:"creator-1",projectId:"project-1"};
    }
  };
  const publicationBoundary={
    async publish(){
      publicationCompleted=true;
      return {recoveryStatus:"created",projectId:"project-1",recoveryRevision:1,recoveryGeneration:1,lineageId:"lineage-1",authorityGeneration:4,progressionRevision:2,envelopeFingerprint:"env-fp",capturedAt:"2026-09-05T00:00:00.000Z"};
    }
  };
  const router=createMovieMentorJourneyRecoveryExpressRouter({
    verifyCredential:async()=>({}), expectedIssuer:"issuer", expectedAudience:"audience",
    createRequestAuthority:()=>requestAuthority,
    createPublicationBoundary:()=>publicationBoundary,
    createHttpAdapter:({publicationBoundary})=>({
      async handle({request,projectId}){
        const publication=await publicationBoundary.publish({request,projectId,expectedRecoveryRevision:0,envelope:{}});
        if(revokeAfterPublication && publicationCompleted) ownershipCurrent=false;
        return {statusCode:200,body:{success:true,projectId:publication.projectId,recoveryRevision:publication.recoveryRevision}};
      }
    })
  });
  const layer=router.stack.find(entry=>entry.route?.path==="/:projectId/recovery");
  assert.ok(layer,"recovery route must exist");
  const res=makeResponse();
  await layer.route.stack[0].handle({params:{projectId:"project-1"},body:{expectedRecoveryRevision:0,envelope:{}},headers:{authorization:"Bearer token"}},res);
  return {res,authorizeCalls};
}

{
  const {res}=await run({revokeAfterPublication:true});
  assert.equal(res.exposures,0,"ownership revoked after successful recovery publication but before HTTP emission must expose zero successful recovery responses");
}

{
  const {res}=await run({revokeAfterPublication:false});
  assert.equal(res.exposures,1,"current ownership must permit exactly one successful recovery HTTP exposure");
}

console.log("PASS Journey recovery HTTP re-exposure authority torture.");
console.log("LAW: recovery publication/write authority is not creator HTTP exposure authority; current ownership must independently authorize successful response emission.");
