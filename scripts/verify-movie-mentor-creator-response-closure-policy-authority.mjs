import assert from "node:assert/strict";
import crypto from "node:crypto";
import { assertCreatorResponseAuthority } from "../ai/MovieMentorTurnRuntime.js";

const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const payload={response:"historical-settled-result"},resultDigest=digest(payload);
const execution={found:true,phase:"settled",executionId:"execution-policy-response",creatorTurnId:"turn-policy-response",principalId:"creator-policy-response",projectId:"project-policy-response",reservationId:"reservation-policy-response",requestDigest:"request-policy-response",closurePolicyVersion:"superseded-policy"};
const canonical={authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,resultReference:"result-policy-response",candidateReference:"candidate-policy-response",executionId:execution.executionId,creatorTurnId:execution.creatorTurnId,principalId:execution.principalId,projectId:execution.projectId,reservationId:execution.reservationId,requestDigest:execution.requestDigest,closureReference:"closure-policy-response",closureCertificateDigest:"closure-digest-policy-response",resultDigest,resultPayload:payload};
const settlement={authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,executionId:canonical.executionId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,resultReference:canonical.resultReference,candidateReference:canonical.candidateReference,resultDigest:canonical.resultDigest,closureCertificateDigest:canonical.closureCertificateDigest,idempotent:true};
assert.throws(()=>assertCreatorResponseAuthority({canonical,settlement,execution}),e=>e.code==="MOVIE_MENTOR_CREATOR_RESPONSE_CLOSURE_POLICY_AUTHORITY_REQUIRED","creator response boundary must not expose settled history whose durable closure policy is superseded");
console.log("GREEN: creator response refuses settled history minted under superseded closure policy.");
console.log("LAW: HISTORICAL SETTLEMENT MAY SURVIVE POLICY SUPERSESSION. CREATOR-VISIBLE CURRENT AUTHORITY MAY NOT.");
