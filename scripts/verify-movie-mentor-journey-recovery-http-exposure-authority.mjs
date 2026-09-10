import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createMovieMentorJourneyRecoveryExpressRouter } from "../ai/MovieMentorJourneyRecoveryExpressRouterFactory.js";
import { createMovieMentorJourneyRecoveryHttpTransportAdapter } from "../ai/MovieMentorJourneyRecoveryHttpTransportAdapter.js";
console.log("5A.28 — Journey recovery HTTP exposure authority torture");
async function withServer(router,run){const app=express();app.use(express.json());app.use("/api/movie-mentor-recovery",router);const server=http.createServer(app);await new Promise(r=>server.listen(0,"127.0.0.1",r));try{await run(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise((r,j)=>server.close(e=>e?j(e):r()));}}
let revoked=false,calls=0;
const current=()=>Object.freeze({authorized:true,principalId:"creator-1",projectId:"project-1",ownershipRef:"ownership:project-1",authenticationSource:"test",authorizationSource:"current-owner"});
const createRequestAuthority=()=>({authorize:async()=>{calls++;if(revoked){const e=new Error("revoked");e.code="MOVIE_MENTOR_AUTH_REVOKED";throw e;}return current();}});
const createPublicationBoundary=({requestAuthority})=>({publish:async({request,projectId})=>{const admitted=await requestAuthority.authorize({request,projectId});assert.equal(admitted.authorized,true);revoked=true;return Object.freeze({recoveryStatus:"idempotent",projectId,recoveryRevision:9,recoveryGeneration:4,lineageId:"lineage-1",authorityGeneration:7,progressionRevision:11,envelopeFingerprint:"historical-fp",capturedAt:"2026-09-05T22:00:00.000Z"});}});
const router=createMovieMentorJourneyRecoveryExpressRouter({verifyCredential:async()=>({verified:true}),expectedIssuer:"https://issuer.example.test",expectedAudience:"iband.movie-mentor",createRequestAuthority,createPublicationBoundary,createHttpAdapter:createMovieMentorJourneyRecoveryHttpTransportAdapter});
await withServer(router,async origin=>{const response=await fetch(`${origin}/api/movie-mentor-recovery/project-1/recovery`,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer owner"},body:JSON.stringify({expectedRecoveryRevision:9,envelope:{domain:"historical-envelope"}})});assert.notEqual(response.status,200,"ownership revoked after recovery resolution but before HTTP emission must expose zero successful recovery results");assert.ok(calls>=2,"the final Express boundary must independently re-earn current creator/project ownership immediately before response emission");});
console.log("✓ historical/idempotent recovery truth cannot authorize present HTTP exposure after ownership revocation");
console.log("LAW: RECOVERY HISTORY MAY REMAIN TRUE. THE RIGHT TO EXPOSE IT TO A CREATOR MUST BE CURRENT AT RES.JSON.");
console.log("5A.28 Journey recovery HTTP exposure authority torture: GREEN");
