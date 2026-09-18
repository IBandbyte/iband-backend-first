import assert from "node:assert/strict";
import { runMovieMentorTurn } from "../ai/MovieMentorTurnRuntime.js";

const principalId="creator-bound-loser",projectId="project-bound-loser",creatorTurnId="turn-bound-loser";
let findCalls=0,reserveCalls=0,openCalls=0,releaseCalls=0,acquireCalls=0,providerCalls=0;
const fail=m=>{throw new Error(m);};

await assert.rejects(
  ()=>runMovieMentorTurn(
    {projectId,creatorTurnId,message:"Continue the scene."},
    {
      serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
      readAuthoritativeTurnSource:async()=>({projectId,creatorSessionId:"session-bound-loser",revision:1,revisionAuthorityReference:"rev-1",creatorStateGeneration:1,creatorStateFingerprint:"fp-1",creatorAuthorityReference:"auth-1",snapshotReference:"snap-1",capturedAt:"2026-09-18T00:00:00.000Z",creatorConfirmedContext:[]}),
      readAuthoritativeRevision:async()=>({authorized:true,revision:1}),
      readAuthoritativeCreatorState:async()=>({authorized:true}),
      inferenceSpendAuthority:{
        reserveTurn:async()=>{reserveCalls+=1;return{authorized:true,status:"reserved",reservationId:"reservation-loser-bound",principalId,projectId,creatorTurnId};},
        readReservation:async()=>fail("BOUND_LOSER_MUST_NOT_REHYDRATE"),
      },
      inferenceSettlementAuthority:{
        releaseUnbound:async({reservationId})=>{
          releaseCalls+=1;assert.equal(reservationId,"reservation-loser-bound");
          return{authorized:false,released:false,outcome:"reserved",reason:"reservation-already-bound-to-execution",executionId:"execution-binding-loser"};
        },
        releaseUnclaimed:async()=>fail("BOUND_LOSER_MUST_NOT_RELEASE_UNCLAIMED"),
        reconcile:async()=>fail("BOUND_LOSER_MUST_NOT_SETTLE_WINNER"),
      },
      inferenceExecutionAuthority:{
        findExecutionByCreatorTurn:async()=>{findCalls+=1;return{found:false,authorized:false};},
        openExecution:async()=>{openCalls+=1;const e=new Error("concurrent execution identity conflict");e.code="MOVIE_MENTOR_INFERENCE_EXECUTION_TURN_IDENTITY_CONFLICT";throw e;},
        acquireExecution:async()=>{acquireCalls+=1;return fail("BOUND_LOSER_MUST_NOT_ACQUIRE_WINNER");},
        readCanonicalResult:async()=>fail("BOUND_LOSER_MUST_NOT_REPLAY"),
        assertFence:async()=>fail("BOUND_LOSER_MUST_NOT_FENCE"),
        claimProviderCall:async()=>{providerCalls+=1;return fail("BOUND_LOSER_MUST_NOT_PROVIDER");},
        beginProviderDispatch:async()=>fail("NO_DISPATCH"),assertProviderDispatch:async()=>fail("NO_DISPATCH"),
        contributeProviderEffectEvidence:async()=>fail("NO_EFFECT"),stageResultCandidate:async()=>fail("NO_STAGE"),
        readResultCandidate:async()=>null,beginExecutionClosing:async()=>fail("NO_CLOSE"),
        reconcileExecutionClosure:async()=>fail("NO_CLOSE"),commitCanonicalResult:async()=>fail("NO_COMMIT"),
      },
      orchestrateTurn:async()=>{providerCalls+=1;return fail("BOUND_LOSER_MUST_NOT_ORCHESTRATE");},
    }),
  e=>e?.code==="MOVIE_MENTOR_INFERENCE_EXECUTION_BINDING_UNRESOLVED"
    && e?.reservationId==="reservation-loser-bound"
    && e?.executionId==="execution-binding-loser"
    && e?.reason==="reservation-already-bound-to-execution",
  "turn-conflict recovery must stop if the supposedly losing fresh reservation is durably execution-bound",
);

assert.equal(findCalls,2,"runtime must stop before post-conflict winner lookup when loser release is denied");
assert.equal(reserveCalls,1);assert.equal(openCalls,1);assert.equal(releaseCalls,1);
assert.equal(acquireCalls,0);assert.equal(providerCalls,0);
console.log("PASS: turn-conflict recovery cannot treat a durably execution-bound losing reservation as unbound; denied release stops recovery before winner lookup or provider authority.");
