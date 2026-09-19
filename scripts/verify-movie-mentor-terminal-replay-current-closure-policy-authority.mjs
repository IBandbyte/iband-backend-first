import assert from "node:assert/strict";
import crypto from "node:crypto";
import { replayTerminalTurn } from "../ai/MovieMentorTurnRuntime.js";

const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const payload={response:"terminal historical result"};
const existing={found:true,phase:"settled",executionId:"execution-terminal-policy",creatorTurnId:"turn-terminal-policy",principalId:"creator-terminal-policy",projectId:"project-terminal-policy",reservationId:"reservation-terminal-policy",requestDigest:"request-terminal-policy",closurePolicyVersion:"superseded-policy"};
const canonical={authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:9,executionId:existing.executionId,creatorTurnId:existing.creatorTurnId,principalId:existing.principalId,projectId:existing.projectId,reservationId:existing.reservationId,requestDigest:existing.requestDigest,resultReference:"result-terminal-policy",candidateReference:"candidate-terminal-policy",resultDigest:digest(payload),closureReference:"closure-terminal-policy",closureCertificateDigest:"closure-digest-terminal-policy",resultPayload:payload};
const settlement={authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:9,executionId:canonical.executionId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,resultReference:canonical.resultReference,candidateReference:canonical.candidateReference,resultDigest:canonical.resultDigest,closureCertificateDigest:canonical.closureCertificateDigest};
await assert.rejects(()=>replayTerminalTurn({existing,inferenceExecutionAuthority:{readCanonicalResult:async()=>canonical},settlementAuthority:{reconcile:async()=>settlement}}),e=>e.code==="MOVIE_MENTOR_CREATOR_RESPONSE_CLOSURE_POLICY_AUTHORITY_REQUIRED","terminal replay must not re-expose a settled result whose durable execution carries superseded closure-policy authority");
console.log("GREEN: terminal replay refuses superseded closure-policy authority.");
console.log("LAW: SETTLED HISTORY MAY SURVIVE. TERMINAL REPLAY AUTHORITY MUST STILL BE CURRENT.");
