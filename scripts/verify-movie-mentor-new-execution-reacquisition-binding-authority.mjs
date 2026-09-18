import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const fail=(m)=>{throw new Error(m)};
let acquireCalls=0, providerCalls=0, orchestrateCalls=0;
const good={executionId:"execution-good",creatorTurnId:"turn-new-acquire",principalId:"creator-new-acquire",projectId:"project-new-acquire",reservationId:"reservation-good",requestDigest:"digest-good",phase:"active",ownerId:"worker-A",authorized:true};
const deps={
  authenticateRequest:async()=>({authorized:true,principalId:"creator-new-acquire"}),
  authorizeProjectAccess:async()=>({authorized:true,projectId:"project-new-acquire"}),
  readAuthoritativeTurnSource:async()=>({projectId:"project-new-acquire",state:{}}),
  createExecutionOwnerId:()=> "worker-B",
  inferenceSpendAuthority:{
    reserve:async()=>({authorized:true,reservationId:"reservation-good",status:"reserved"}),
    readReservation:async()=>({authorized:true,reservationId:"reservation-good",status:"reserved"}),
  },
  inferenceExecutionAuthority:{
    findExecutionByCreatorTurn:async()=>({found:false}),
    openExecution:async()=>good,
    acquireExecution:async()=>{acquireCalls++;return {authorized:true,executionId:"execution-OTHER",creatorTurnId:"turn-OTHER",principalId:"creator-OTHER",projectId:"project-OTHER",reservationId:"reservation-OTHER",requestDigest:"digest-OTHER",phase:"active",ownerId:"worker-B",leaseGeneration:99};},
    assertFence:async(x)=>x,
    claimProviderCall:async()=>{providerCalls++;fail("MISMATCHED_ACQUISITION_MUST_NOT_CLAIM_PROVIDER");},
  },
  inferenceSettlementAuthority:{releaseUnclaimed:async()=>({authorized:true,released:true,outcome:"released",executionPhase:"released"}),releaseUnbound:async()=>({authorized:true,released:true})},
  orchestrateTurn:async()=>{orchestrateCalls++;fail("MISMATCHED_ACQUISITION_MUST_NOT_ORCHESTRATE");},
};
await assert.rejects(
  ()=>runMovieMentorTurn({creatorTurnId:"turn-new-acquire",message:"bind fresh reacquisition",projectId:"project-new-acquire",options:{}},deps),
  e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_ACQUISITION_BINDING_INVALID"
);
assert.equal(acquireCalls,1);
assert.equal(orchestrateCalls,0);
assert.equal(providerCalls,0);
console.log("✓ authorized fresh-execution reacquisition must preserve immutable execution/spend/turn identity");
console.log("✓ mismatch fails before orchestration/provider work");
console.log("LAW: AUTHORIZED REACQUISITION WITHOUT DURABLE IDENTITY BINDING IS NOT FORWARD AUTHORITY.");
