import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

console.log("Movie Mentor inference-spend last-unit concurrency authority court");

const clone=value=>value==null?value:structuredClone(value);
const entitlementIndexes=[{name:"principalId_1",key:{principalId:1},unique:true}];
const reservationIndexes=[{name:"reservationId_1",key:{reservationId:1},unique:true}];
const reservations=new Map();
let entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-last-unit",status:"active",remainingUnits:1,reservedUnits:0,consumedUnits:0,entitlementRevision:1};
let sessionsEnded=0;

function query(run){return{session(){return this;},lean(){return this;},async exec(){return clone(await run());}};}

const Reservation={
 async createIndexes(){},
 collection:{async indexes(){return reservationIndexes;}},
 findOne({reservationId}){return query(()=>reservations.get(reservationId)||null);},
 async create(rows){const row=clone(rows[0]);reservations.set(row.reservationId,{...row,reservedAt:new Date(row.reservedAt),settledAt:null,settlementReason:null,settlementExecutionId:null,settlementResultReference:null,settlementCandidateReference:null,settlementResultDigest:null});return[clone(reservations.get(row.reservationId))];}
};
const Entitlement={
 async createIndexes(){},
 collection:{async indexes(){return entitlementIndexes;}},
 findOneAndUpdate(filter,update){return query(()=>{
   if(filter.principalId!==entitlement.principalId||filter.status!=="active")return null;
   const required=filter.remainingUnits?.$gte;
   if(Number.isFinite(required)&&entitlement.remainingUnits<required)return null;
   for(const[key,delta]of Object.entries(update?.$inc||{}))entitlement[key]=(entitlement[key]||0)+delta;
   return entitlement;
 });}
};
const startSession=async()=>({async withTransaction(fn){await fn();},async endSession(){sessionsEnded+=1;}});
const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel:Entitlement,reservationModel:Reservation},startSession});

const request=id=>({reservationId:id,principalId:"creator-last-unit",projectId:"project-last-unit",operation:"movie-mentor-turn",units:1});
const [a,b]=await Promise.all([store.reserve(request("reservation-a")),store.reserve(request("reservation-b"))]);
const outcomes=[a,b];
const granted=outcomes.filter(x=>x?.granted===true);
const denied=outcomes.filter(x=>x?.granted===false);
assert.equal(granted.length,1,"exactly one fresh reservation may receive the final available entitlement unit");
assert.equal(denied.length,1,"the competing fresh reservation must observe exhausted durable capacity");
assert.equal(denied[0].reason,"no-active-entitlement-or-insufficient-units");
assert.equal(entitlement.remainingUnits,0);
assert.equal(entitlement.reservedUnits,1);
assert.equal(entitlement.consumedUnits,0);
assert.equal(entitlement.entitlementRevision,2,"only the successful fresh reservation may advance entitlement revision");
assert.equal(reservations.size,1,"only one durable reservation row may be created from the final unit");
assert.equal(sessionsEnded,2);

console.log("GREEN: two distinct fresh reservations competing for one remaining entitlement unit produce exactly one durable reservation and one denial.");
console.log("LAW: ONE REMAINING UNIT MAY AUTHORIZE ONE FRESH RESERVATION. CONCURRENT DEMAND MAY NOT DUPLICATE DURABLE ECONOMIC CAPACITY.");
