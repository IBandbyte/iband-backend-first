import assert from "node:assert/strict";
import {createForwardExecutionRuntimeDeps} from "../ai/MovieMentorForwardExecutionRuntime.js";

const binding=Object.freeze({creatorTurnId:"turn-provider-spend",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"digest-1",ownerId:"owner-1"});
let spendCurrent=true;
let spendReads=0;
let claimWrites=0;

const inferenceSpendAuthority=Object.freeze({
  async readReservation({reservationId,principalId,projectId}={}){
    spendReads+=1;
    assert.equal(reservationId,binding.reservationId);
    assert.equal(principalId,binding.principalId);
    assert.equal(projectId,binding.projectId);
    if(!spendCurrent){
      const error=new Error("Reserved spend lost current entitlement authority before provider-call admission.");
      error.code="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED";
      throw error;
    }
    return Object.freeze({authorized:true,reservationId,principalId,projectId,status:"reserved",units:1,entitlementRevision:11});
  },
});

const forwardExecutionAuthority=Object.freeze({
  domain:"iband.movie-mentor.forward-execution-authority",schema:1,principalId:binding.principalId,projectId:binding.projectId,
  async assertCurrentReacquisition(){throw new Error("reacquisition is outside this court");},
  async assertCurrentCreation(target={}){return Object.freeze({domain:"iband.movie-mentor.forward-execution-proof",schema:1,authorized:true,currentOwnershipVerified:true,ownershipRef:"ownership:project-1",ownershipRevision:3,transition:"execution-creation",...target});},
  async assertCurrentProviderCallAdmission(target={}){return Object.freeze({domain:"iband.movie-mentor.forward-execution-proof",schema:1,authorized:true,currentOwnershipVerified:true,ownershipRef:"ownership:project-1",ownershipRevision:3,transition:"provider-call-admission",...target});},
});

const execution=Object.freeze({authorized:true,executionAuthorized:true,schema:6,phase:"active",executionId:"execution-1",...binding,leaseGeneration:1,leaseReference:"lease-1",fencingToken:"fence-1",leaseExpiresAt:"2035-01-01T00:01:00.000Z",maxProviderCalls:5,providerCallsClaimed:0});
const baseExecutionAuthority=Object.freeze({
  async findExecutionByCreatorTurn(){return Object.freeze({found:false,authorized:false});},
  async acquireExecution(){throw new Error("reacquisition is outside this court");},
  async openExecution(input={}){
    await input.assertCurrentCreationAuthority(execution);
    return execution;
  },
  async claimProviderCall(input={}){
    const candidate=Object.freeze({...execution,providerCallId:"provider-call-1",slotId:input.slotId,task:input.task,admittedAt:"2035-01-01T00:00:01.000Z"});
    await input.assertCurrentProviderCallAdmissionAuthority(candidate);
    claimWrites+=1;
    return Object.freeze({authorized:true,dispatchAuthorized:true,...candidate});
  },
});

const guarded=createForwardExecutionRuntimeDeps({inferenceExecutionAuthority:baseExecutionAuthority,inferenceSpendAuthority,forwardExecutionAuthority}).inferenceExecutionAuthority;
const opened=await guarded.openExecution(binding);
assert.equal(opened.authorized,true);
assert.equal(spendReads,1,"fresh execution creation must consume the first current-spend proof");

spendCurrent=false;
await assert.rejects(
  ()=>guarded.claimProviderCall({execution:opened,slotId:"semantic",task:"movie-mentor-semantic"}),
  error=>error?.code==="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED",
  "provider-call admission must independently re-enter the exact reservation under current entitlement reality",
);
assert.equal(spendReads,2,"provider-call admission must own a second current-spend proof rather than borrow execution-creation history");
assert.equal(claimWrites,0,"no provider-call authority may become durable after current entitlement authority is lost");

console.log("GREEN: provider-call admission independently revalidates the exact reserved spend row under current entitlement reality.");
console.log("LAW: EXECUTION CREATION DOES NOT LEND ITS SPEND PROOF TO PROVIDER-CALL ADMISSION.");

// CI (Backend) owns this verifier directly. Execute the adjacent spend courts here so
// Backend CI owns the actual irreversible-dispatch and durable-UNKNOWN proofs too.
await import("./verify-movie-mentor-provider-dispatch-current-spend-authority.mjs");
await import("./verify-movie-mentor-provider-unknown-current-spend-authority.mjs");
