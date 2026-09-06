import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";

console.log("5A.30 — Journey recovery ACK-loss historical reconciliation re-exposure authority torture");

let ownershipCurrent=true;
let publicationCompleted=false;
let ackLossReconciled=false;
let successfulResponses=0;
let finalStatus=null;
let finalBody=null;

const owned=()=>Object.freeze({authorized:true,principalId:"creator-1",projectId:"project-1",ownershipRef:"ownership:project-1",authenticationSource:"test",authorizationSource:"current-owner"});
const requestAuthority={
  async authorize(){
    if(!ownershipCurrent){const e=new Error("revoked");e.code="MOVIE_MENTOR_AUTH_REVOKED";throw e;}
    return owned();
  }
};

const recovered=Object.freeze({
  recoveryStatus:"committed-after-ack-loss",
  projectId:"project-1",
  recoveryRevision:8,
  recoveryGeneration:8,
  recoveryReference:"recovery-8",
  recoveryFingerprint:"recovery-fp-8",
  lineageId:"lineage-1",
  authorityGeneration:12,
  progressionRevision:20,
  envelopeFingerprint:"fingerprint-ack-loss-recovered-checkpoint",
  capturedAt:"2026-09-06T01:30:00.000Z"
});

const publicationBoundary={
  async publish(){
    publicationCompleted=true;
    ackLossReconciled=true;
    return recovered;
  }
};

const router=createMovieMentorJourneyRecoveryExpressRouter({
  verifyCredential:async()=>({}),
  expectedIssuer:"issuer",
  expectedAudience:"audience",
  createRequestAuthority:()=>requestAuthority,
  createPublicationBoundary:()=>publicationBoundary,
  createHttpAdapter:({publicationBoundary})=>({
    async handle(){
      const publication=await publicationBoundary.publish();
      assert.equal(publication.recoveryStatus,"committed-after-ack-loss","torture must exercise ACK-loss historical reconciliation");
      assert.equal(publicationCompleted,true);
      assert.equal(ackLossReconciled,true);
      ownershipCurrent=false;
      return {statusCode:200,body:{success:true,status:publication.recoveryStatus,projectId:publication.projectId,recoveryRevision:publication.recoveryRevision,recoveryGeneration:publication.recoveryGeneration,lineageId:publication.lineageId,authorityGeneration:publication.authorityGeneration,progressionRevision:publication.progressionRevision,envelopeFingerprint:publication.envelopeFingerprint,capturedAt:publication.capturedAt}};
    }
  })
});

const layer=router.stack.find(entry=>entry.route?.path==="/:projectId/recovery");
assert.ok(layer,"recovery route must exist");

const req={params:{projectId:"project-1"},body:{expectedRecoveryRevision:7,envelope:{}}};
const res={
  status(code){finalStatus=code;return this;},
  json(body){finalBody=body;if(finalStatus===200&&body?.success===true)successfulResponses++;return body;}
};

await layer.route.stack[0].handle(req,res);

assert.equal(publicationCompleted,true,"historical recovery publication must resolve before revocation");
assert.equal(ackLossReconciled,true,"test must reach ACK-loss reconciliation result");
assert.equal(successfulResponses,0,"ownership revoked after ACK-loss reconciliation but before HTTP emission must expose zero successful recovery responses");
assert.equal(finalStatus,403,"revoked ACK-loss recovery re-exposure must fail closed");
assert.deepEqual(finalBody,{success:false,code:"MOVIE_MENTOR_RECOVERY_FORBIDDEN",message:"Recovery publication is not authorized."},"revoked ACK-loss re-exposure must be sanitized");

console.log("PASS — ACK-loss reconciliation may recover durable reality, but creator-facing exposure independently re-earns current ownership authority.");
