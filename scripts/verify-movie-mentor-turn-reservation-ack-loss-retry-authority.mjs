import assert from "node:assert/strict";
import fs from "node:fs";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor turn reservation acknowledgement-loss retry authority court");

const runtimeSource=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
assert.ok(runtimeSource.indexOf("findExecutionByCreatorTurn")<runtimeSource.indexOf("reserveTurn"),"runtime must inspect durable same-turn execution before creating fresh economic authority");
assert.match(runtimeSource,/releaseFreshUnboundReservation/);
assert.match(runtimeSource,/settlementAuthority\.releaseUnbound/);

const serverAuthority={authenticated:true,projectAuthorized:true,principalId:"creator-ack",projectId:"project-ack"};
const durable={projectId:"project-ack",creatorSessionId:"session-ack",revision:1,revisionAuthorityReference:"revision:ack:1",creatorStateGeneration:1,creatorStateFingerprint:"a".repeat(64),creatorAuthorityReference:"creator-state:ack:1",snapshotReference:"snapshot:ack:1",capturedAt:"2035-01-01T00:00:00.000Z",creatorConfirmedContext:[],projectJourney:null,memoryContext:null,responseBlueprint:null,communicationPlan:null};
let reserveCalls=0,releaseUnboundCalls=0,openCalls=0;
let existing=null;
const reservations=[];
const spend={
 async reserveTurn(){reserveCalls+=1;const reservation={authorized:true,reservationId:`reservation-${reserveCalls}`,principalId:"creator-ack",projectId:"project-ack",operation:"movie-mentor-turn",units:1,status:"reserved"};reservations.push(reservation);return reservation;},
 async readReservation({reservationId}){return reservations.find(r=>r.reservationId===reservationId)||null;}
};
const settlement={
 async releaseUnbound({reservationId,principalId,projectId}){releaseUnboundCalls+=1;return{authorized:true,released:true,outcome:"released",reservationId,principalId,projectId,idempotent:false};},
 async releaseUnclaimed(){return{authorized:true,released:true,outcome:"released",executionId:"execution-ack",reservationId:"reservation-1",principalId:"creator-ack",projectId:"project-ack",idempotent:false};},
 async reconcile(){throw new Error("settlement not expected");}
};
const executionAuthority={
 async findExecutionByCreatorTurn(){return existing?{...existing,found:true,authorized:true}:{found:false,authorized:false};},
 async openExecution({reservation,creatorTurnId,requestDigest}){openCalls+=1;existing={authorized:true,executionId:"execution-ack",creatorTurnId,principalId:"creator-ack",projectId:"project-ack",reservationId:reservation.reservationId,requestDigest,phase:"active",ownerId:"owner-ack",leaseGeneration:1,leaseReference:"lease-ack",fencingToken:"fence-ack",leaseExpiresAt:"2099-01-01T00:00:00.000Z"};const error=new Error("simulated acknowledgement loss after durable execution creation");error.code="SIMULATED_ACK_LOSS";throw error;}
};

await assert.rejects(()=>runMovieMentorTurn({projectId:"project-ack",creatorSessionId:"session-ack",creatorTurnId:"turn-ack",message:"same creator action"},{serverAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlement,createExecutionOwnerId:()=>"owner-ack",readAuthoritativeTurnSource:async()=>structuredClone(durable)}),error=>error?.code==="SIMULATED_ACK_LOSS");
assert.equal(reserveCalls,1,"first transport attempt may create exactly one reservation");
assert.equal(openCalls,1);
assert.equal(existing.reservationId,"reservation-1","durable execution must retain the first economic identity despite lost acknowledgement");
assert.equal(releaseUnboundCalls,0,"a reservation already bound to durable execution must not be released as unbound");

await assert.rejects(()=>runMovieMentorTurn({projectId:"project-ack",creatorSessionId:"session-ack",creatorTurnId:"turn-ack",message:"same creator action"},{serverAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlement,readAuthoritativeTurnSource:async()=>structuredClone(durable)}),error=>Boolean(error));
assert.equal(reserveCalls,1,"same-turn retry must discover durable execution before any second reservation is created");
assert.equal(openCalls,1,"same-turn retry must not create a second execution");
assert.equal(reservations.length,1,"one creator action must retain one durable economic reservation identity");
assert.equal(existing.reservationId,"reservation-1");

console.log("GREEN: acknowledgement loss after durable execution creation cannot make same-turn retry create a second reservation identity.");
console.log("LAW: RETRY MUST RECOVER DURABLE TURN HISTORY BEFORE CREATING NEW ECONOMIC AUTHORITY. ONE CREATOR TURN MAY NOT BECOME TWO RESERVATIONS BECAUSE AN ACKNOWLEDGEMENT WAS LOST.");
