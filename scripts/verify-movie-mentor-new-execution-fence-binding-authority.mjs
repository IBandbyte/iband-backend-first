import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";
const fail=m=>{throw new Error(m)};let fenceCalls=0,orchestrateCalls=0,providerCalls=0;
const principalId="creator-fence-bind",projectId="project-fence-bind",creatorTurnId="turn-fence-bind",reservationId="reservation-fence-bind";
const opened={authorized:true,phase:"active",executionId:"execution-good",creatorTurnId,principalId,projectId,reservationId,requestDigest:"digest-good",ownerId:"worker-current"};
const executionAuthority={
 findExecutionByCreatorTurn:async()=>({found:false}),
 openExecution:async()=>structuredClone(opened),
 acquireExecution:async()=>fail("NO_ACQUIRE"),
 assertFence:async()=>{fenceCalls++;return{authorized:true,phase:"active",executionId:"execution-OTHER",creatorTurnId:"turn-OTHER",principalId:"creator-OTHER",projectId:"project-OTHER",reservationId:"reservation-OTHER",requestDigest:"digest-OTHER",ownerId:"worker-current"};},
 claimProviderCall:async()=>{providerCalls++;fail("MISMATCHED_FENCE_MUST_NOT_REACH_PROVIDER")},
 beginProviderDispatch:async()=>fail("NO_DISPATCH"),assertProviderDispatch:async()=>fail("NO_DISPATCH"),contributeProviderEffectEvidence:async()=>fail("NO_EFFECT"),
 beginExecutionClosing:async()=>fail("NO_CLOSE"),reconcileExecutionClosure:async()=>fail("NO_CLOSE"),stageResultCandidate:async()=>fail("NO_STAGE"),readResultCandidate:async()=>null,commitCanonicalResult:async()=>fail("NO_COMMIT"),readCanonicalResult:async()=>({authorized:false,committed:false})
};
await assert.rejects(()=>runMovieMentorTurn({projectId,creatorTurnId,message:"bind current fence"},{
 serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
 readAuthoritativeTurnSource:async()=>({projectId,creatorSessionId:"session-1",revision:1,revisionAuthorityReference:"rev-1",creatorStateGeneration:1,creatorStateFingerprint:"fp-1",creatorAuthorityReference:"auth-1",snapshotReference:"snap-1",capturedAt:"2026-09-18T10:00:00.000Z",creatorConfirmedContext:[]}),
 readAuthoritativeRevision:async()=>({authorized:true,revision:1}),readAuthoritativeCreatorState:async()=>({authorized:true}),
 createExecutionOwnerId:()=>"worker-current",
 inferenceSpendAuthority:{reserveTurn:async()=>({authorized:true,reservationId,status:"reserved"}),readReservation:async()=>({authorized:true,reservationId,status:"reserved",principalId,projectId})},
 inferenceExecutionAuthority:executionAuthority,
 inferenceSettlementAuthority:{reconcile:async()=>fail("NO_SETTLE"),releaseUnclaimed:async()=>({authorized:true,released:true,outcome:"released",executionPhase:"released"}),releaseUnbound:async()=>({authorized:true,released:true,outcome:"released",executionPhase:"released"})},
 orchestrateTurn:async()=>{orchestrateCalls++;fail("MISMATCHED_FENCE_MUST_NOT_ORCHESTRATE")}
}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_FENCE_BINDING_INVALID");
assert.equal(fenceCalls,1);assert.equal(orchestrateCalls,0);assert.equal(providerCalls,0);
console.log("PASS: authorized current-fence evidence must remain bound to the exact opened execution before provider work.");
console.log("LAW: AUTHORIZED FENCE EVIDENCE WITHOUT DURABLE IDENTITY BINDING IS NOT FORWARD AUTHORITY.");
