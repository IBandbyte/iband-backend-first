import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";

const historical={reservationId:"r-rehydrate",principalId:"creator-1",projectId:"project-1",operation:"movie-mentor-turn",units:1,entitlementRevision:7,status:"reserved"};

async function attempt(currentEntitlement){
  let reserveCalls=0;
  const store={
    readReservation:async()=>structuredClone(historical),
    reserve:async request=>{reserveCalls+=1;if(currentEntitlement!=="active")return{granted:false,reason:"no-active-entitlement-or-insufficient-units"};return{granted:true,idempotent:true,reservation:{...historical,...request}};},
  };
  const authority=createMovieMentorInferenceSpendAuthority({store,createReservationId:()=>historical.reservationId});
  try{return{ok:true,result:await authority.readReservation({reservationId:historical.reservationId,principalId:historical.principalId,projectId:historical.projectId}),reserveCalls};}
  catch(error){return{ok:false,error,reserveCalls};}
}

const current=await attempt("active");
assert.equal(current.ok,true,"rehydration may authorize reserved spend while current entitlement authority survives");
assert.ok(current.reserveCalls>0,"rehydration must re-enter the durable current-entitlement reservation boundary rather than trusting history alone");

const revoked=await attempt("suspended");
assert.equal(revoked.ok,false,"historical reserved spend must not rehydrate into forward authority after entitlement suspension");
assert.equal(revoked.error?.code,"MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED");

console.log("GREEN: spend reservation rehydration cannot turn historical reservation state into current forward authority without re-entering entitlement authority.");
console.log("LAW: REHYDRATION MAY READ HISTORY; FORWARD SPEND AUTHORITY MUST BE RE-EARNED FROM CURRENT ENTITLEMENT REALITY.");
