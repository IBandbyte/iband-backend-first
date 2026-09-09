import assert from "node:assert/strict";
import {createForwardExecutionRuntimeDeps} from "../ai/MovieMentorForwardExecutionRuntime.js";

const binding=Object.freeze({
  creatorTurnId:"turn-spend-execution-current-entitlement",
  principalId:"creator-1",
  projectId:"project-1",
  reservationId:"reservation-1",
  requestDigest:"digest-1",
  ownerId:"owner-1",
});

let executionCreates=0;
let reservationRevalidations=0;

const inferenceSpendAuthority=Object.freeze({
  async readReservation({reservationId,principalId,projectId}={}){
    reservationRevalidations+=1;
    assert.equal(reservationId,binding.reservationId);
    assert.equal(principalId,binding.principalId);
    assert.equal(projectId,binding.projectId);
    const error=new Error("Historical reserved spend cannot bootstrap a new execution after current entitlement authority was suspended.");
    error.code="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED";
    throw error;
  },
});

const baseExecutionAuthority=Object.freeze({
  async findExecutionByCreatorTurn(){return Object.freeze({found:false,authorized:false,reason:"execution-not-found"});},
  async acquireExecution(){throw new Error("reacquisition is outside this court");},
  async openExecution(input={}){
    const target=Object.freeze({
      ...binding,
      executionId:"execution-1",
      leaseGeneration:1,
      leaseReference:"lease-1",
      fencingToken:"fence-1",
    });
    await input.assertCurrentCreationAuthority(target);
    executionCreates+=1;
    return Object.freeze({authorized:true,phase:"active",...target});
  },
});

const forwardExecutionAuthority=Object.freeze({
  domain:"iband.movie-mentor.forward-execution-authority",
  schema:1,
  principalId:binding.principalId,
  projectId:binding.projectId,
  async assertCurrentReacquisition(){throw new Error("reacquisition is outside this court");},
  async assertCurrentCreation(target={}){
    return Object.freeze({
      domain:"iband.movie-mentor.forward-execution-proof",
      schema:1,
      authorized:true,
      currentOwnershipVerified:true,
      ownershipRef:"ownership:project-1",
      ownershipRevision:7,
      transition:"execution-creation",
      ...target,
    });
  },
});

const guarded=createForwardExecutionRuntimeDeps({
  inferenceExecutionAuthority:baseExecutionAuthority,
  inferenceSpendAuthority,
  forwardExecutionAuthority,
}).inferenceExecutionAuthority;

await assert.rejects(
  () => guarded.openExecution(binding),
  error => error?.code === "MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_REHYDRATION_AUTHORITY_REQUIRED",
  "fresh execution creation must re-enter current spend/entitlement authority at its own forward-authority boundary",
);

assert.equal(reservationRevalidations,1,"execution creation must independently revalidate its exact durable reservation under current entitlement reality");
assert.equal(executionCreates,0,"no durable execution may be created after the reservation loses current entitlement authority");

console.log("GREEN: fresh execution creation independently revalidates the exact reservation under current entitlement reality.");
console.log("LAW: A RESERVED SPEND ROW MAY SURVIVE ENTITLEMENT SUSPENSION AS HISTORY; IT MAY NOT BOOTSTRAP A NEW EXECUTION.");
