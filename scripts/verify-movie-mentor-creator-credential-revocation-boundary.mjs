import assert from "node:assert/strict";
import {createMovieMentorCreatorRequestAuthority} from "../ai/MovieMentorCreatorRequestAuthority.js";
import {createMovieMentorCreatorStateMutationAuthority,assertMovieMentorCreatorStateMutationAuthority} from "../ai/MovieMentorCreatorStateMutationAuthority.js";

const status=Object.freeze({domain:"iband.movie-mentor.project-ownership-authority",configured:true,durable:true,authorization:"durable-owner-match",createOnce:true,projectUnique:true,establishmentAuthorityUnique:true,legacyAdoption:"certified-attestation-only",ownershipTransfer:false,processLocalFallback:false});
let revoked=false,verificationCalls=0,ownershipCalls=0;
const now=new Date("2026-11-07T12:00:00.000Z");
const authority=createMovieMentorCreatorRequestAuthority({
 now:()=>now,
 verifyCredential:async()=>{verificationCalls++;return {verified:true,subject:"creator-1",issuer:"issuer-1",audience:"audience-1",verificationMethod:"test-verifier",verificationVersion:"1",authenticatedAt:"2026-11-07T11:00:00.000Z",expiresAt:"2026-11-07T13:00:00.000Z",revoked};},
 expectedIssuer:"issuer-1",expectedAudience:"audience-1",
 ownershipAuthority:{getStatus:()=>status,authorizeProject:async({principal,projectId})=>{ownershipCalls++;return {authorized:true,projectId,ownershipRef:"owner-ref-1",ownershipRevision:1,authorizationSource:"test-durable-ownership-contract"};}}
});
const request={headers:{authorization:"Bearer isolated-test-credential"}};
const initial=await authority.authorize({request,projectId:"project-1"});
assert.equal(initial.authorized,true);
assert.equal(verificationCalls,1);
const mutation=createMovieMentorCreatorStateMutationAuthority({request,authorization:initial,requestAuthority:authority});
const target={authority:mutation,projectId:"project-1",source:"test-credential-revocation",expectedRevision:0,revision:1,creatorStateGeneration:1,creatorStateFingerprint:"fingerprint-1"};
revoked=true;
await assert.rejects(()=>assertMovieMentorCreatorStateMutationAuthority(target),e=>e?.code==="MOVIE_MENTOR_AUTH_REVOKED");
assert.equal(verificationCalls,2,"fresh credential verification must occur at mutation authority");
assert.equal(ownershipCalls,1,"revoked credential must deny before a second ownership grant");
console.log("GREEN: revoked credential is denied at the fresh pre-mutation authorization boundary");
console.log("LIMITATION: authority-level court only; no Mongo transaction, post-fence revocation, HTTP journey, or live Clerk revocation guarantee tested");
