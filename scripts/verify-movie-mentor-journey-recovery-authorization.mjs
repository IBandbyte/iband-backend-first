import assert from "node:assert/strict";
import { authorizeMovieMentorJourneyRecoveryRequest } from "../ai/MovieMentorJourneyRecoveryAuthorizationBoundary.js";

const projectId="project-auth-1";
await assert.rejects(()=>authorizeMovieMentorJourneyRecoveryRequest({projectId}),e=>e.code==="MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_REQUIRED");
await assert.rejects(()=>authorizeMovieMentorJourneyRecoveryRequest({projectId,principal:{principalId:"user-1",authenticated:false}}),e=>e.code==="MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_REQUIRED");
await assert.rejects(()=>authorizeMovieMentorJourneyRecoveryRequest({projectId,principal:{principalId:"user-1",authenticated:true}}),e=>e.code==="MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_RESOLVER_REQUIRED");
await assert.rejects(()=>authorizeMovieMentorJourneyRecoveryRequest({projectId,principal:{principalId:"user-1",authenticated:true},authorizeProject:async()=>({authorized:false})}),e=>e.code==="MOVIE_MENTOR_JOURNEY_RECOVERY_NOT_AUTHORIZED");
await assert.rejects(()=>authorizeMovieMentorJourneyRecoveryRequest({projectId,principal:{principalId:"user-1",authenticated:true},authorizeProject:async()=>({authorized:true,projectId:"other-project"})}),e=>e.code==="MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHORIZATION_PROJECT_CONFLICT");
const ok=await authorizeMovieMentorJourneyRecoveryRequest({projectId,principal:{principalId:"user-1",authenticated:true},authorizeProject:async({principal,projectId})=>({authorized:principal.principalId==="user-1"&&projectId==="project-auth-1",projectId,ownershipRef:"owner:user-1/project:project-auth-1",authorizationSource:"test-deterministic-owner-map"})});
assert.equal(ok.authorized,true);assert.equal(ok.principalId,"user-1");assert.equal(ok.projectId,projectId);assert.equal(ok.authorizationSource,"test-deterministic-owner-map");

const perfectEnvelope={domain:"iband.movie-mentor.journey-authority-recovery-envelope",schema:1,project:{projectId}};
await assert.rejects(()=>authorizeMovieMentorJourneyRecoveryRequest({projectId:perfectEnvelope.project.projectId,principal:null,authorizeProject:async()=>({authorized:true,projectId})}),e=>e.code==="MOVIE_MENTOR_JOURNEY_RECOVERY_AUTHENTICATION_REQUIRED");

console.log("Movie Mentor Journey recovery authorization boundary torture passed.");
console.log("- recovery envelope possession grants zero authorization");
console.log("- deterministic authenticated principal is mandatory");
console.log("- deterministic project authorization resolver is mandatory");
console.log("- cross-project authorization substitution is rejected");
