import assert from "node:assert/strict";
import { createMovieMentorNativeProjectCreationAuthority } from "../ai/MovieMentorNativeProjectCreationAuthority.js";

const PROJECT="movie-project-123e4567-e89b-42d3-a456-426614174000";
const OTHER="movie-project-123e4567-e89b-42d3-a456-426614174001";
const IDENTITY=Object.freeze({domain:"iband.movie-mentor.project",schema:1,issuance:"secure-web-crypto",legacy:false});
const verifyCredential=async()=>({verified:true,subject:"creator-return-bind",issuer:"issuer",audience:"movie-mentor",verificationMethod:"fixture",verificationVersion:"1",sessionReference:"session",authenticatedAt:"2026-09-18T00:00:00.000Z",expiresAt:"2099-01-01T00:00:00.000Z",active:true});
const ownershipAuthority={
 async establishNativeOwnership(){
   return {status:"established",ownership:{projectId:PROJECT,ownerPrincipalId:"creator-return-bind",ownershipRevision:1,ownershipReference:`ownership:${OTHER}`,status:"active"}};
 }
};
const authority=createMovieMentorNativeProjectCreationAuthority({verifyCredential,expectedIssuer:"issuer",expectedAudience:"movie-mentor",ownershipAuthority});
await assert.rejects(
 ()=>authority.establishFromRequest({request:{headers:{authorization:"Bearer fixture"}},projectId:PROJECT,identity:IDENTITY}),
 e=>e?.code==="MOVIE_MENTOR_NATIVE_PROJECT_CREATION_OWNERSHIP_RESULT_INVALID",
 "native project creation must reject ownership evidence whose durable ownershipReference belongs to another project universe"
);
console.log("Movie Mentor native project ownership return binding authority: PASS");
console.log("LAW: DURABLE OWNERSHIP EVIDENCE MUST BIND THE EXACT PROJECT UNIVERSE BEFORE CREATION RETURNS SUCCESS.");
