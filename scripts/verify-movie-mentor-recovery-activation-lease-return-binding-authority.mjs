import assert from "node:assert/strict";
import { createMovieMentorJourneyRecoveryActivationLeaseMongoStore } from "../ai/MovieMentorJourneyRecoveryActivationLeaseMongoStore.js";

const base={processInstanceId:"process-A",deploymentId:"deploy-A",basePath:"/recovery",expectedIssuer:"issuer-A",expectedAudience:"audience-A",status:"active",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"fence-A",acquiredAt:"2035-01-01T00:00:00.000Z",expiresAt:"2035-01-01T00:10:00.000Z"};
const next={...base,expiresAt:"2035-01-01T00:20:00.000Z"};
const durable={domain:"iband.movie-mentor.journey-recovery-activation-lease-store",schema:1,serviceKey:"movie-mentor-journey-recovery-activation",...base};
const wrong={...durable,processInstanceId:"process-OTHER",deploymentId:"deploy-OTHER",expiresAt:next.expiresAt};
const q=v=>({lean(){return this},async exec(){return structuredClone(v)}});
let reads=0;
const mongoModel={
 collection:{async indexes(){return [{key:{serviceKey:1},unique:true}]}},
 findOne(){reads++;return q(durable)},
 findOneAndUpdate(){return q(wrong)}
};
const store=createMovieMentorJourneyRecoveryActivationLeaseMongoStore({mongoModel});
let failure=null;
try{await store.replaceLease(next,{expectedLeaseGeneration:1,expectedLeaseReference:"lease-A",expectedExpiresAt:base.expiresAt})}catch(error){failure=error}
assert.ok(failure,"renewal must reject Mongo return evidence from a different holder universe");
assert.equal(failure.code,"MOVIE_MENTOR_RECOVERY_ACTIVATION_LEASE_MONGO_RETURN_BINDING_INVALID");
console.log("Movie Mentor recovery activation lease return binding authority: GREEN");
console.log("LAW: A SUCCESSFUL LEASE CAS RETURN MUST BIND THE EXACT REQUESTED HOLDER AND FENCE UNIVERSE.");
