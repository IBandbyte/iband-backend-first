import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

function query(value){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function session(){return{async withTransaction(fn){await fn();},async endSession(){}};}

const entitlementIndexes=Object.freeze([{name:"principalId_1",key:Object.freeze({principalId:1}),unique:true}]);
const reservationIndexes=Object.freeze([{name:"reservationId_1",key:Object.freeze({reservationId:1}),unique:true}]);
const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"reservation-idempotent-court",principalId:"creator-1",projectId:"project-1",operation:"movie-mentor-turn",units:1,entitlementRevision:7,status:"reserved",reservedAt:new Date("2035-01-01T00:00:00.000Z"),settledAt:null,settlementReason:null,settlementExecutionId:null,settlementResultReference:null,settlementCandidateReference:null,settlementResultDigest:null};

async function attempt({entitlementStatus="active",remainingUnits=10}={}){
  let entitlementChecks=0,physicalIndexReads=0;
  const Reservation={
    async createIndexes(){},
    collection:{async indexes(){physicalIndexReads+=1;return reservationIndexes;}},
    findOne:()=>query(reservation),
    create:async()=>{throw new Error("idempotent court must not create a second reservation");}
  };
  const Entitlement={
    async createIndexes(){},
    collection:{async indexes(){physicalIndexReads+=1;return entitlementIndexes;}},
    findOneAndUpdate(){entitlementChecks+=1;return query(entitlementStatus==="active"&&remainingUnits>=1?{domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-1",status:"active",remainingUnits,reservedUnits:1,consumedUnits:0,entitlementRevision:8}:null);}
  };
  const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel:Entitlement,reservationModel:Reservation},startSession:async()=>session()});
  try{return{ok:true,result:await store.reserve({reservationId:reservation.reservationId,principalId:reservation.principalId,projectId:reservation.projectId,operation:reservation.operation,units:reservation.units}),entitlementChecks,physicalIndexReads};}
  catch(error){return{ok:false,error,entitlementChecks,physicalIndexReads};}
}

const current=await attempt();
assert.equal(current.ok,true,"idempotent reservation may be reused while its entitlement remains current");
assert.equal(current.result?.idempotent,true);
assert.equal(current.physicalIndexReads,2,"idempotent reuse must first prove the spend store's entitlement and reservation physical identities");
assert.ok(current.entitlementChecks>0,"idempotent reuse must re-enter durable entitlement authority");

const suspended=await attempt({entitlementStatus:"suspended"});
assert.equal(suspended.ok,false,"a historical reserved row must not mint current spend authority after entitlement suspension");
assert.equal(suspended.error?.code,"MOVIE_MENTOR_INFERENCE_SPEND_IDEMPOTENT_ENTITLEMENT_FENCED");
assert.equal(suspended.physicalIndexReads,2,"revocation court must satisfy the hardened store's own physical proof before testing current entitlement fencing");

console.log("GREEN: idempotent inference-spend reuse re-earns current durable entitlement authority after proving its own physical store identity.");
console.log("LAW: A RESERVED HISTORY ROW MAY SURVIVE ENTITLEMENT REVOCATION; CURRENT SPEND AUTHORITY MAY NOT, AND NO COURT MAY BORROW PHYSICAL UNIQUENESS FROM A NEIGHBOUR.");
