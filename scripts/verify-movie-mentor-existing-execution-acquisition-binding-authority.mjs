import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const principalId="creator-acquire-bind",projectId="project-acquire-bind",creatorTurnId="turn-acquire-bind";
const reservationId="reservation-good",executionId="execution-good";
let providerCalls=0,reserveCalls=0,acquireCalls=0;
const fail=m=>{throw new Error(m);};
const durable={projectId,creatorSessionId:"session-1",revision:1,revisionAuthorityReference:"rev-1",creatorStateGeneration:1,creatorStateFingerprint:"fp-1",creatorAuthorityReference:"auth-1",snapshotReference:"snap-1",capturedAt:"2026-09-18T09:30:00.000Z",creatorConfirmedContext:[]};
const existing={found:true,authorized:true,phase:"active",executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest:"digest-existing",ownerId:"old-owner",leaseGeneration:1,leaseReference:"lease-old",fencingToken:"fence-old",leaseExpiresAt:"2099-01-01T00:00:00.000Z"};
const methods={
 findExecutionByCreatorTurn:async()=>structuredClone(existing),
 openExecution:async()=>fail("NO_OPEN"),
 acquireExecution:async()=>{acquireCalls+=1;return{authorized:true,phase:"active",executionId:"execution-OTHER",creatorTurnId:"turn-OTHER",principalId:"creator-OTHER",projectId:"project-OTHER",reservationId:"reservation-OTHER",requestDigest:"digest-OTHER",ownerId:"new-owner",leaseGeneration:99,leaseReference:"lease-OTHER",fencingToken:"fence-OTHER",leaseExpiresAt:"2099-01-01T00:00:00.000Z"};},
 assertFence:async()=>fail("NO_FENCE"),claimProviderCall:async()=>{providerCalls+=1;return fail("MISMATCHED_ACQUISITION_MUST_NOT_REACH_PROVIDER");},
 beginProviderDispatch:async()=>fail("NO_DISPATCH"),assertProviderDispatch:async()=>fail("NO_DISPATCH"),contributeProviderEffectEvidence:async()=>fail("NO_EFFECT"),
 stageResultCandidate:async()=>fail("NO_STAGE"),readResultCandidate:async()=>null,beginExecutionClosing:async()=>fail("NO_CLOSE"),reconcileExecutionClosure:async()=>fail("NO_CLOSE"),commitCanonicalResult:async()=>fail("NO_COMMIT"),readCanonicalResult:async()=>({authorized:false,committed:false})
};
await assert.rejects(()=>runMovieMentorTurn({projectId,creatorTurnId,message:"Continue my scene."},{
 serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
 readAuthoritativeTurnSource:async()=>structuredClone(durable),readAuthoritativeRevision:async()=>({authorized:true,revision:1}),readAuthoritativeCreatorState:async()=>({authorized:true}),
 inferenceSpendAuthority:{reserveTurn:async()=>{reserveCalls+=1;return fail("NO_RESERVE");},readReservation:async()=>({authorized:true,status:"reserved",reservationId,principalId,projectId})},
 inferenceExecutionAuthority:methods,
 inferenceSettlementAuthority:{reconcile:async()=>fail("NO_SETTLE"),releaseUnclaimed:async()=>({authorized:true,released:true,outcome:"released",executionPhase:"released"}),releaseUnbound:async()=>fail("NO_RELEASE")},
 orchestrateTurn:async()=>{providerCalls+=1;return fail("MISMATCHED_ACQUISITION_MUST_NOT_ORCHESTRATE");},
}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_ACQUISITION_BINDING_INVALID");
assert.equal(acquireCalls,1);assert.equal(reserveCalls,0);assert.equal(providerCalls,0);
console.log("PASS: authorized acquisition evidence must remain bound to the requested existing execution before provider work.");
