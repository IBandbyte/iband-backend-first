import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildRequestDigest } from "../ai/MovieMentorTurnRuntime.js";
import { assertCreatorHttpExposureAuthority } from "../movieMentorTurn.js";

const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const body={projectId:"project-http-policy",creatorTurnId:"turn-http-policy",message:"Expose this result",options:{}};
const authority={authorized:true,principalId:"creator-http-policy",projectId:body.projectId};
const payload={success:true,mentorResponse:{text:"historical result"}};
const requestDigest=buildRequestDigest({creatorMessage:body.message,projectId:body.projectId,options:body.options});
const canonical={authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",executionId:"execution-http-policy",creatorTurnId:body.creatorTurnId,principalId:authority.principalId,projectId:body.projectId,reservationId:"reservation-http-policy",requestDigest,resultReference:"result-http-policy",candidateReference:"candidate-http-policy",closureReference:"closure-http-policy",closureCertificateDigest:"closure-digest-http-policy",resultDigest:digest(payload),resultPayload:payload,providerEffectRealityRevision:9,closurePolicyVersion:"superseded-policy"};
const settlement={authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:9,executionId:canonical.executionId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,resultReference:canonical.resultReference,candidateReference:canonical.candidateReference,resultDigest:canonical.resultDigest,closureCertificateDigest:canonical.closureCertificateDigest};
const result={...structuredClone(payload),metadata:{canonicalResult:{authorized:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,creatorResponseAuthorityVerified:true,resultReference:canonical.resultReference,candidateReference:canonical.candidateReference,resultDigest:canonical.resultDigest,executionId:canonical.executionId,closureReference:canonical.closureReference,closureCertificateDigest:canonical.closureCertificateDigest,reservationId:canonical.reservationId,settlement:"consumed",settlementExecutionPhase:"settled"}}};
await assert.rejects(()=>assertCreatorHttpExposureAuthority({result,authorized:{body,authority},inferenceExecutionAuthority:{readCanonicalResult:async()=>structuredClone(canonical)},inferenceSettlementAuthority:{reconcile:async()=>structuredClone(settlement)}}),e=>e.code==="MOVIE_MENTOR_CREATOR_HTTP_EXPOSURE_CLOSURE_POLICY_AUTHORITY_REQUIRED","HTTP gateway must independently refuse canonical history minted under superseded closure policy");
console.log("GREEN: HTTP exposure independently refuses superseded closure-policy history.");
console.log("LAW: RUNTIME PROOF DOES NOT LEND CURRENT POLICY AUTHORITY TO THE HTTP GATEWAY.");
