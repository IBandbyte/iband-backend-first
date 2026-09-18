import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryActivationLeaseMongoStore } from "../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js";
const requested={processInstanceId:"process-A",deploymentId:"deploy-A",basePath:"/recovery",expectedIssuer:"issuer-A",expectedAudience:"audience-A",status:"active",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"fence-A",acquiredAt:"2035-01-01T00:00:00.000Z",expiresAt:"2035-01-01T00:10:00.000Z"};
const wrong={domain:"iband.movie-mentor.journey-recovery-activation-lease-store",schema:1,serviceKey:"movie-mentor-journey-recovery-activation",...requested,processInstanceId:"process-OTHER",deploymentId:"deploy-OTHER",leaseReference:"lease-OTHER",fencingToken:"fence-OTHER"};
const mongoModel={collection:{async indexes(){return [{key:{serviceKey:1},unique:true}]}},async create(){return structuredClone(wrong)}};
const store=createMovieMentorJourneyRecoveryActivationLeaseMongoStore({mongoModel});
let failure=null;try{await store.createLease(requested)}catch(error){failure=error}
assert.ok(failure,"initial lease mint must reject Mongo create evidence from a different holder/fence universe");
assert.equal(failure.code,"MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_CREATE_RETURN_BINDING_INVALID");
console.log("Movie Mentor recovery activation lease create return binding authority: GREEN");
console.log("LAW: A SUCCESSFUL LEASE MINT RETURN MUST BIND THE EXACT REQUESTED HOLDER AND FENCE UNIVERSE.");
