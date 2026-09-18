import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";
const fail=m=>{throw new Error(m)};let fence=0,orch=0;
const principalId="creator-open-bind",projectId="project-open-bind",creatorTurnId="turn-open-bind",reservationId="reservation-open-bind";
const authority={
 findExecutionByCreatorTurn:async()=>({found:false}),
 openExecution:async()=>({authorized:true,phase:"active",executionId:"execution-OTHER",creatorTurnId:"turn-OTHER",principalId:"creator-OTHER",projectId:"project-OTHER",reservationId:"reservation-OTHER",requestDigest:"digest-OTHER",ownerId:"worker-current"}),
 assertFence:async x=>{fence++;return{...x,authorized:true}},
 acquireExecution:async()=>fail("NO_ACQUIRE"),claimProviderCall:async()=>fail("NO_PROVIDER"),beginProviderDispatch:async()=>fail("NO_PROVIDER"),assertProviderDispatch:async()=>fail("NO_PROVIDER"),contributeProviderEffectEvidence:async()=>fail("NO_PROVIDER"),beginExecutionClosing:async()=>fail("NO_CLOSE"),reconcileExecutionClosure:async()=>fail("NO_CLOSE"),stageResultCandidate:async()=>fail("NO_STAGE"),readResultCandidate:async()=>null,commitCanonicalResult:async()=>fail("NO_COMMIT"),readCanonicalResult:async()=>({authorized:false,committed:false})
};
await assert.rejects(()=>runMovieMentorTurn({projectId,creatorTurnId,message:"opened binding"},{
 serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
 readAuthoritativeTurnSource:async()=>({projectId,creatorSessionId:"session",revision:1,revisionAuthorityReference:"rev",creatorStateGeneration:1,creatorStateFingerprint:"fp",creatorAuthorityReference:"auth",snapshotReference:"snap",capturedAt:"2026-09-18T10:30:00.000Z",creatorConfirmedContext:[]}),
 readAuthoritativeRevision:async()=>({authorized:true,revision:1}),readAuthoritativeCreatorState:async()=>({authorized:true}),createExecutionOwnerId:()=>"worker-current",
 inferenceSpendAuthority:{reserveTurn:async()=>({authorized:true,reservationId,status:"reserved"}),readReservation:async()=>({authorized:true,reservationId,status:"reserved",principalId,projectId})},
 inferenceExecutionAuthority:authority,inferenceSettlementAuthority:{reconcile:async()=>fail("NO_SETTLE"),consume:async()=>fail("NO_CONSUME"),releaseUnclaimed:async()=>({authorized:true,released:true,outcome:"released",executionPhase:"released"}),releaseUnbound:async()=>({authorized:true,released:true,outcome:"released",executionPhase:"released"})},
 orchestrateTurn:async()=>{orch++;fail("MISMATCHED_OPEN_MUST_NOT_ORCHESTRATE")}
}),e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_OPEN_BINDING_INVALID");
assert.equal(fence,0);assert.equal(orch,0);
console.log("PASS: authorized openExecution evidence must bind exact requested turn/principal/project/reservation/request before fence/provider work.");
console.log("LAW: AUTHORIZED OPEN EVIDENCE IS NOT AUTHORITY FOR A DIFFERENT DURABLE EXECUTION UNIVERSE.");
