import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";

console.log("Movie Mentor creator-turn reservation retry identity authority court");

const serverAuthority=Object.freeze({authenticated:true,projectAuthorized:true,principalId:"creator-308",projectId:"project-308"});
let ids=["reservation-A","reservation-B"],writes=0;
const rows=new Map();
const store={
  async reserve(request){
    writes+=1;
    const existing=rows.get(request.reservationId);
    if(existing)return {granted:true,idempotent:true,reservation:structuredClone(existing)};
    const row={...request,entitlementRevision:writes,status:"reserved",reservedAt:new Date("2035-01-01T00:00:00.000Z").toISOString()};
    rows.set(request.reservationId,row);
    return {granted:true,idempotent:false,reservation:structuredClone(row)};
  },
  async readReservation(id){return rows.has(id)?structuredClone(rows.get(id)):null;}
};
const authority=createMovieMentorInferenceSpendAuthority({store,createReservationId:()=>ids.shift()});

const first=await authority.reserveTurn({serverAuthority,projectId:"project-308",creatorTurnId:"turn-308"});
assert.equal(first.reservationId,"reservation-A");
assert.equal(rows.size,1);

// Simulate transport/process loss after durable reservation but before execution binding.
// The same stable Creator turn retries through the public reservation authority.
const retry=await authority.reserveTurn({serverAuthority,projectId:"project-308",creatorTurnId:"turn-308"});
assert.equal(retry.reservationId,"reservation-A","RED: same stable creatorTurnId must converge on its existing pre-execution reservation instead of minting a second reservation universe.");
assert.equal(rows.size,1,"RED: one Creator turn must not own two simultaneously reserved spend universes before execution binding.");
assert.equal(retry.idempotent,true);

console.log("GREEN: same Creator turn converges on one durable pre-execution reservation identity.");
console.log("LAW: TRANSPORT FAILURE BEFORE EXECUTION BINDING MAY RETRY THE TURN; IT MAY NOT MINT A SECOND RESERVED SPEND UNIVERSE FOR THE SAME STABLE CREATOR TURN.");
