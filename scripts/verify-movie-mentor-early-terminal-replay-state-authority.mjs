import assert from "node:assert/strict";
import { runMovieMentorTurn, buildRequestDigest } from "../ai/MovieMentorTurnRuntime.js";
import crypto from "node:crypto";

const principalId="creator-early-replay",projectId="project-early-replay",creatorTurnId="turn-early-replay",executionId="execution-terminal",reservationId="reservation-terminal";
let stateReads=0,canonicalReads=0,settlementCalls=0,providerCalls=0,reserveCalls=0;
const requestDigestSeen=[];\nconst stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;\nconst payload={success:true,text:"durable terminal result"};\nconst digest=crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
const fail=m=>{throw new Error(m);};

const result=await runMovieMentorTurn({projectId,creatorTurnId,message:"Replay this turn."},{
 serverAuthority:{authenticated:true,projectAuthorized:true,principalId,projectId},
 readAuthoritativeTurnSource:async()=>{stateReads+=1;return{projectId:"different-durable-project",creatorSessionId:"session-1",revision:2,revisionAuthorityReference:"rev-2",creatorStateGeneration:2,creatorStateFingerprint:"fp-2",creatorAuthorityReference:"auth-2",snapshotReference:"snap-2",capturedAt:"2026-09-18T00:00:00.000Z",creatorConfirmedContext:[]};},
 readAuthoritativeRevision:async()=>({authorized:true,revision:2}),
 readAuthoritativeCreatorState:async()=>({authorized:true}),
 inferenceSpendAuthority:{reserveTurn:async()=>{reserveCalls+=1;return fail("TERMINAL_REPLAY_MUST_NOT_RESERVE");},readReservation:async()=>fail("TERMINAL_REPLAY_MUST_NOT_REHYDRATE_SPEND")},
 inferenceSettlementAuthority:{
  releaseUnbound:async()=>fail("NO_RELEASE"),releaseUnclaimed:async()=>fail("NO_RELEASE"),
  reconcile:async({executionId:id})=>{settlementCalls+=1;assert.equal(id,executionId);return{authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,executionId,principalId,projectId,reservationId,resultReference:"result-1",candidateReference:"candidate-1",resultDigest:digest,closureCertificateDigest:"closure-digest-1",idempotent:true};},
 },
 inferenceExecutionAuthority:{
  findExecutionByCreatorTurn:async({requestDigest})=>{requestDigestSeen.push(requestDigest);return{found:true,authorized:true,phase:"settled",executionId,reservationId,principalId,projectId,creatorTurnId,requestDigest};},
  readCanonicalResult:async({executionId:id})=>{canonicalReads+=1;assert.equal(id,executionId);return{authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest:requestDigestSeen[0],resultReference:"result-1",candidateReference:"candidate-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",resultDigest:digest,resultPayload:structuredClone(payload)};},
  acquireExecution:async()=>fail("NO_ACQUIRE"),openExecution:async()=>fail("NO_OPEN"),assertFence:async()=>fail("NO_FENCE"),
  claimProviderCall:async()=>{providerCalls+=1;return fail("NO_PROVIDER");},beginProviderDispatch:async()=>fail("NO_DISPATCH"),assertProviderDispatch:async()=>fail("NO_DISPATCH"),
  contributeProviderEffectEvidence:async()=>fail("NO_EFFECT"),stageResultCandidate:async()=>fail("NO_STAGE"),readResultCandidate:async()=>null,
  beginExecutionClosing:async()=>fail("NO_CLOSE"),reconcileExecutionClosure:async()=>fail("NO_CLOSE"),commitCanonicalResult:async()=>fail("NO_COMMIT"),
 },
 orchestrateTurn:async()=>{providerCalls+=1;return fail("NO_ORCHESTRATION");},
});
assert.equal(stateReads,0,"terminal replay returned before durable creator-state/project authority was re-read");
assert.equal(result?.text,"durable terminal result");
assert.equal(result?.metadata?.replayedFromDurableResult,true);
assert.equal(canonicalReads,1);assert.equal(settlementCalls,1);assert.equal(reserveCalls,0);assert.equal(providerCalls,0);
assert.equal(requestDigestSeen.length,1);
console.log("OBSERVED: terminal creator-turn replay can cross the response boundary before current durable creator-state/project authority is re-read.");
