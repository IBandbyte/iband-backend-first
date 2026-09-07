import assert from "node:assert/strict";
import fs from "node:fs";
import { assertCreatorResponseAuthority } from "../ai/MovieMentorTurnRuntime.js";
import { createMovieMentorInferenceSettlementReconciliationAuthority } from "../ai/MovieMentorInferenceSettlementReconciliationAuthority.js";

const payload={response:"creator-result",metadata:{source:"candidate-lineage-torture"}};
const canonical={authorized:true,committed:true,currentRealityVerified:true,candidateLineageVerified:true,resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,resultReference:"result-1",candidateReference:"candidate-1",executionId:"execution-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",resultDigest:"",resultPayload:payload};
const crypto=await import("node:crypto");
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
canonical.resultDigest=crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
const execution={found:true,phase:"settled",executionId:canonical.executionId,creatorTurnId:canonical.creatorTurnId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,requestDigest:canonical.requestDigest};
const settlementBase={authorized:true,settled:true,outcome:"consumed",resultFinalizationVerified:true,executionPhase:"settled",providerEffectRealityRevision:7,executionId:canonical.executionId,principalId:canonical.principalId,projectId:canonical.projectId,reservationId:canonical.reservationId,resultReference:canonical.resultReference,candidateReference:canonical.candidateReference,resultDigest:canonical.resultDigest,closureCertificateDigest:canonical.closureCertificateDigest,idempotent:true};

assert.equal(
  assertCreatorResponseAuthority({canonical,settlement:settlementBase,execution}),
  true,
  "creator response must accept settlement proof bound to the exact canonical candidate lineage",
);

assert.throws(
  ()=>assertCreatorResponseAuthority({canonical,settlement:{...settlementBase,candidateReference:"candidate-2"},execution}),
  error=>error.code==="MOVIE_MENTOR_CREATOR_RESPONSE_BINDING_INVALID"&&error.field==="candidateReference",
  "creator response must reject settlement proof borrowed from a different candidate lineage",
);

assert.throws(
  ()=>assertCreatorResponseAuthority({canonical,settlement:{...settlementBase,candidateReference:null},execution}),
  error=>error.code==="MOVIE_MENTOR_CREATOR_RESPONSE_BINDING_INVALID"&&error.field==="candidateReference",
  "creator response must fail closed when settlement candidate lineage is absent",
);

const noopRelease=async()=>({authorized:false,released:false,outcome:"reserved",reason:"not-under-test"});
const completeDecision={...settlementBase};
const reconciliation=createMovieMentorInferenceSettlementReconciliationAuthority({store:{settleCanonicalResult:async()=>completeDecision,releaseUnclaimedReservation:noopRelease,releaseUnboundReservation:noopRelease}});
const reconciled=await reconciliation.reconcile({executionId:canonical.executionId});
assert.equal(reconciled.candidateReference,canonical.candidateReference,"settlement reconciliation must preserve the exact candidateReference proved by the atomic store");
assert.equal(assertCreatorResponseAuthority({canonical,settlement:reconciled,execution}),true,"reconciled settlement candidate lineage must authorize the exact creator response");

const missingCandidateReconciliation=createMovieMentorInferenceSettlementReconciliationAuthority({store:{settleCanonicalResult:async()=>({...completeDecision,candidateReference:null}),releaseUnclaimedReservation:noopRelease,releaseUnboundReservation:noopRelease}});
await assert.rejects(
  ()=>missingCandidateReconciliation.reconcile({executionId:canonical.executionId}),
  error=>error.code==="MOVIE_MENTOR_SETTLEMENT_RECONCILIATION_INVALID",
  "settlement reconciliation must refuse to manufacture authority when atomic settlement omits candidate lineage",
);

const runtime=fs.readFileSync(new URL("../ai/MovieMentorTurnRuntime.js",import.meta.url),"utf8");
const settlementAuthority=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementReconciliationAuthority.js",import.meta.url),"utf8");
assert.match(runtime,/settlementBindingKeys[\s\S]*"candidateReference"/);
assert.match(settlementAuthority,/candidateReference:text\(decision\.candidateReference\)/);

console.log("Movie Mentor settlement candidate-lineage creator-response authority: GREEN");
console.log("LAW: THE CREATOR RESPONSE MUST BIND THE SETTLEMENT PROOF TO THE EXACT CANDIDATE THAT BECAME CANONICAL.");
console.log("LAW: SETTLEMENT RECONCILIATION MAY TRANSPORT CANDIDATE AUTHORITY; IT MAY NOT ERASE IT.");
