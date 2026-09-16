import assert from "node:assert/strict";
import { createMovieMentorInferenceSpendAuthority } from "../ai/MovieMentorInferenceSpendAuthority.js";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

console.log("Movie Mentor pre-execution reservation acknowledgement-loss authority court");

const serverAuthority={authenticated:true,projectAuthorized:true,principalId:"creator-pre-ack",projectId:"project-pre-ack"};
const durable={projectId:"project-pre-ack",creatorSessionId:"session-pre-ack",revision:1,revisionAuthorityReference:"revision:pre-ack:1",creatorStateGeneration:1,creatorStateFingerprint:"a".repeat(64),creatorAuthorityReference:"creator-state:pre-ack:1",snapshotReference:"snapshot:pre-ack:1",capturedAt:"2035-01-01T00:00:00.000Z",creatorConfirmedContext:[],projectJourney:null,memoryContext:null,responseBlueprint:null,communicationPlan:null};
const rows=new Map();
let remaining=2,durableReserveCalls=0,ackLossPending=true,openCalls=0,releaseUnboundCalls=0;
let existing=null;

const store={
 async reserve(request){
  durableReserveCalls+=1;
  const existingRow=rows.get(request.reservationId);
  if(existingRow)return{granted:true,reservation:structuredClone(existingRow),idempotent:true};
  if(remaining<request.units)return{granted:false,reason:"insufficient-capacity"};
  remaining-=request.units;
  const reservation={...request,status:"reserved",entitlementRevision:1};
  rows.set(request.reservationId,structuredClone(reservation));
  return{granted:true,reservation:structuredClone(reservation),idempotent:false};
 },
 async readReservation(reservationId){const row=rows.get(reservationId);return row?structuredClone(row):null;}
};

const realSpend=createMovieMentorInferenceSpendAuthority({store});
const spend={
 async reserveTurn(args){
  const reservation=await realSpend.reserveTurn(args);
  if(ackLossPending){ackLossPending=false;const error=new Error("simulated acknowledgement loss after durable reservation commit and before runtime receives it");error.code="SIMULATED_PRE_EXECUTION_RESERVATION_ACK_LOSS";throw error;}
  return reservation;
 },
 readReservation(args){return realSpend.readReservation(args);}
};

const settlement={
 async releaseUnbound({reservationId,principalId,projectId}){
  releaseUnboundCalls+=1;
  if(existing?.reservationId===reservationId)return{authorized:false,released:false,outcome:"reserved",reason:"reservation-already-bound-to-execution",executionId:existing.executionId,reservationId,principalId,projectId};
  return{authorized:true,released:true,outcome:"released",reservationId,principalId,projectId,idempotent:false};
 },
 async releaseUnclaimed(){return{authorized:true,released:true,outcome:"released",executionId:"execution-pre-ack",reservationId:existing?.reservationId,principalId:"creator-pre-ack",projectId:"project-pre-ack",idempotent:false};},
 async reconcile(){throw new Error("settlement not expected");}
};

const executionAuthority={
 async findExecutionByCreatorTurn(){return existing?{...existing,found:true,authorized:true}:{found:false,authorized:false};},
 async openExecution({reservationId,creatorTurnId,requestDigest,principalId,projectId,ownerId}){
  openCalls+=1;
  existing={authorized:true,executionId:"execution-pre-ack",creatorTurnId,principalId,projectId,reservationId,requestDigest,phase:"active",ownerId,leaseGeneration:1,leaseReference:"lease-pre-ack",fencingToken:"fence-pre-ack",leaseExpiresAt:"2099-01-01T00:00:00.000Z"};
  const error=new Error("stop after recovered reservation binds to execution");error.code="STOP_AFTER_RECOVERED_RESERVATION_BIND";throw error;
 },
 async acquireExecution(){throw new Error("acquire not expected");},async assertFence(){throw new Error("fence not expected");},async claimProviderCall(){throw new Error("provider claim not expected");},async beginProviderDispatch(){throw new Error("provider dispatch not expected");},async assertProviderDispatch(){throw new Error("provider dispatch assertion not expected");},async contributeProviderEffectEvidence(){throw new Error("provider evidence not expected");},async beginExecutionClosing(){throw new Error("closing not expected");},async reconcileExecutionClosure(){throw new Error("closure not expected");},async stageResultCandidate(){throw new Error("candidate staging not expected");},async readResultCandidate(){return null;},async commitCanonicalResult(){throw new Error("canonical commit not expected");},async readCanonicalResult(){return null;}
};

const deps={serverAuthority,inferenceSpendAuthority:spend,inferenceExecutionAuthority:executionAuthority,inferenceSettlementAuthority:settlement,createExecutionOwnerId:()=>"owner-pre-ack",readAuthoritativeTurnSource:async()=>structuredClone(durable)};
const input={projectId:"project-pre-ack",creatorSessionId:"session-pre-ack",creatorTurnId:"turn-pre-ack",message:"same creator action"};

await assert.rejects(()=>runMovieMentorTurn(input,deps),error=>error?.code==="SIMULATED_PRE_EXECUTION_RESERVATION_ACK_LOSS");
assert.equal(rows.size,1,"first attempt must durably commit exactly one reservation");
assert.equal(remaining,1,"first attempt must reserve exactly one unit");
assert.equal(openCalls,0,"lost reservation acknowledgement must occur before execution binding");
const firstReservationId=[...rows.keys()][0];

await assert.rejects(()=>runMovieMentorTurn(input,deps),error=>error?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_BINDING_UNRESOLVED"&&error?.reason==="reservation-already-bound-to-execution");
assert.equal(durableReserveCalls,2,"retry may revisit durable reservation authority exactly once");
assert.equal(rows.size,1,"same creator-turn retry must not mint a second durable reservation");
assert.equal(remaining,1,"same creator-turn retry must not reserve a second unit");
assert.equal(openCalls,1,"retry must bind the recovered reservation to one execution");
assert.equal(existing.creatorTurnId,"turn-pre-ack","runtime must carry the stable creator-turn identity into the execution universe");
assert.equal(existing.reservationId,firstReservationId,"runtime retry must recover the exact reservation committed before acknowledgement loss");
assert.equal(releaseUnboundCalls,1,"cleanup may inspect the now-bound recovered reservation but must not erase it");

console.log("GREEN: the real runtime carries creatorTurnId into real spend authority, so a committed reservation whose response is lost before execution binding is recovered idempotently on same-turn retry.");
console.log("LAW: ONE CREATOR ACTION MAY OWN ONLY ONE DURABLE RESERVATION EVEN WHEN THE FIRST RESERVATION RESPONSE IS LOST BEFORE EXECUTION BINDING.");
