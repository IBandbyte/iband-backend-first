import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendMongoStore } from "../ai/MovieMentorInferenceSpendMongoStore.js";

console.log("Movie Mentor inference-spend reservation identity collision authority court");

const entitlementIndexes=[{name:"principalId_1",key:{principalId:1},unique:true}];
const reservationIndexes=[{name:"reservationId_1",key:{reservationId:1},unique:true}];
const clone=value=>value==null?value:structuredClone(value);
const query=value=>({session(){return this;},lean(){return this;},async exec(){return clone(value);}});

let reservationRow=null;
let entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"creator-collision",status:"active",remainingUnits:10,reservedUnits:0,consumedUnits:0,entitlementRevision:1};
let sessionsEnded=0;

const Reservation={
  async createIndexes(){},
  collection:{async indexes(){return reservationIndexes;}},
  findOne({reservationId}){return query(reservationRow?.reservationId===reservationId?reservationRow:null);},
  async create(rows){
    const next=clone(rows[0]);
    if(reservationRow?.reservationId===next.reservationId){
      const error=new Error("E11000 duplicate key reservationId");
      error.code=11000;
      throw error;
    }
    reservationRow={...next,reservedAt:new Date(next.reservedAt),settledAt:null,settlementReason:null,settlementExecutionId:null,settlementResultReference:null,settlementCandidateReference:null,settlementResultDigest:null};
    return [clone(reservationRow)];
  }
};

const Entitlement={
  async createIndexes(){},
  collection:{async indexes(){return entitlementIndexes;}},
  findOneAndUpdate(filter,update){
    const eligible=filter.principalId===entitlement.principalId&&filter.status==="active"&&(!filter.remainingUnits?.$gte||entitlement.remainingUnits>=filter.remainingUnits.$gte);
    if(!eligible)return query(null);
    for(const [key,delta] of Object.entries(update?.$inc||{}))entitlement[key]=(entitlement[key]||0)+delta;
    return query(entitlement);
  }
};

const startSession=async()=>({
  async withTransaction(fn){
    const beforeReservation=clone(reservationRow),beforeEntitlement=clone(entitlement);
    try{await fn();}
    catch(error){reservationRow=beforeReservation;entitlement=beforeEntitlement;throw error;}
  },
  async endSession(){sessionsEnded+=1;}
});

const store=createMovieMentorInferenceSpendMongoStore({models:{entitlementModel:Entitlement,reservationModel:Reservation},startSession});
const common={reservationId:"reservation-collision",principalId:"creator-collision",operation:"movie-mentor-turn",units:1};

const first=await store.reserve({...common,projectId:"project-a"});
assert.equal(first.granted,true);
assert.equal(first.idempotent,false);
assert.equal(reservationRow.projectId,"project-a");
assert.equal(entitlement.remainingUnits,9);
assert.equal(entitlement.reservedUnits,1);

await assert.rejects(
  ()=>store.reserve({...common,projectId:"project-b"}),
  error=>error?.code==="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_CONFLICT"
);
assert.equal(reservationRow.projectId,"project-a","collision must preserve the original durable reservation owner");
assert.equal(entitlement.remainingUnits,9,"collision must not debit a second unit");
assert.equal(entitlement.reservedUnits,1,"collision must not create a second reserved balance");

const retry=await store.reserve({...common,projectId:"project-a"});
assert.equal(retry.granted,true);
assert.equal(retry.idempotent,true,"same durable binding may recover idempotently");
assert.equal(reservationRow.projectId,"project-a");
assert.equal(entitlement.remainingUnits,9,"idempotent recovery must not debit remaining units again");
assert.equal(entitlement.reservedUnits,1,"idempotent recovery must not reserve a second unit");
assert.equal(sessionsEnded,3);

console.log("GREEN: duplicate reservation identity cannot cross into a different fresh-turn binding; the original durable reservation remains authoritative.");
console.log("LAW: ONE RESERVATION IDENTITY MAY HAVE ONE DURABLE ECONOMIC BINDING. COLLISION MAY RECOVER THE SAME BINDING; IT MAY NOT AUTHORIZE A DIFFERENT ONE.");
