import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

function query(value){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function session(){return{async withTransaction(fn){await fn();},async endSession(){}};}

const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-idempotent-court",principalId:"creator-1",projectId:"project-1",operation:"movie-mentor-turn",units:1,entitlementRevision:7,status:"reserved",reservedAt:new Date("2035-01-01T00:00:00.000Z"),settledAt:null,settlementReason:null,settlementExecutionId:null,settlementResultReference:null,settlementCandidateReference:null,settlementResultDigest:null};

async function attempt({entitlementStatus="active",remainingUnits=10}={}){
  let entitlementChecks=0;
  const Reservation={findOne:()=>query(reservation),create:async()=>{throw new Error("idempotent court must not create a second reservation");}};
  const Entitlement={findOneAndUpdate(){entitlementChecks+=1;return query(entitlementStatus==="active"&&remainingUnits>=1?{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-1",status:"active",remainingUnits,reservedUnits:1,consumedUnits:0,entitlementRevision:8}:null);}};
  const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel:Entitlement,reservationModel:Reservation},startSession:async()=>session()});
  try{return{ok:true,result:await store.reserve({reservationId:reservation.reservationId,principalId:reservation.principalId,projectId:reservation.projectId,operation:reservation.operation,units:reservation.units}),entitlementChecks};}
  catch(error){return{ok:false,error,entitlementChecks};}
}

const current=await attempt();
assert.equal(current.ok,true,"idempotent reservation may be reused while its entitlement remains current");
assert.equal(current.result?.idempotent,true);
assert.ok(current.entitlementChecks>0,"idempotent reuse must re-enter durable entitlement authority");

const suspended=await attempt({entitlementStatus:"suspended"});
assert.equal(suspended.ok,false,"a historical reserved row must not mint current spend authority after entitlement suspension");
assert.equal(suspended.error?.code,"MOVIE_MENTOR_INFERENCE_SPEND_IDEMPOTENT_ENTITLEMENT_FENCED");

console.log("GREEN: idempotent inference-spend reuse re-earns current durable entitlement authority.");
console.log("LAW: A RESERVED HISTORY ROW MAY SURVIVE ENTITLEMENT REVOCATION; CURRENT SPEND AUTHORITY MAY NOT.");
