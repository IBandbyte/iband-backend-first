import assert from "node:assert/strict";
import fs from "node:fs";
import { assertCreatorResponseAuthority } from "../ai/MovieMentorTurnRuntime.js";

const payload={response:"creator-result",metadata:{source:"candidate-lineage-torture"}};
const canonical={authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,resultReference:"result-1",candidateReference:"candidate-1",executionId:"execution-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",resultDigest:"" ,resultPayload:payload};
const crypto=await import("node:crypto");
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
canonical.resultDigest=crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
const execution={found:true,phase:"settled",executionId:canonical.executionId,creatorTurnId:canonical.creatorTurnId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,requestDigest:canonical.requestDigest};
const settlement={authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,executionId:canonical.executionId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,resultReference:canonical.resultReference,candidateReference:"candidate-2",resultDigest:canonical.resultDigest,closureCertificateDigest:canonical.closureCertificateDigest,idempotent:true};

assert.throws(
  ()=>assertCreatorResponseAuthority({canonical,settlement,execution}),
  error=>error.code==="MOVIE_MENTOR_CREATOR_RESPONSE_BINDING_INVALID"&&error.field==="candidateReference",
  "creator response must reject settlement proof borrowed from a different candidate lineage",
);

const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const settlementAuthority=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementReconciliationAuthority.js",import.meta.url),"utf8");
assert.match(runtime,/"candidateReference"/);
assert.match(settlementAuthority,/candidateReference/);

console.log("Movie Mentor settlement candidate-lineage creator-response authority: GREEN");
console.log("LAW: THE CREATOR RESPONSE MUST BIND THE SETTLEMENT PROOF TO THE EXACT CANDIDATE THAT BECAME CANONICAL.");
