import assert from "node:assert/strict";
import { createMovieMentorCanonicalResultAuthority } from "../ai/MovieMentorCanonicalResultAuthority.js";

const record={schema:2,resultReference:"result-policy-read",candidateReference:"candidate-policy-read",executionId:"execution-policy-read",creatorTurnId:"turn-policy-read",principalId:"creator-policy-read",projectId:"project-policy-read",reservationId:"reservation-policy-read",requestDigest:"request-policy-read",closureReference:"closure-policy-read",closureCertificateDigest:"closure-digest-policy-read",resultDigest:"digest-policy-read",resultPayload:{response:"historical"},committedAt:"2032-01-01T00:00:00.000Z"};
const current={authorized:true,closed:true,finalized:true,currentRealityVerified:true,phase:"settled",executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,closureReference:record.closureReference,closureCertificateDigest:record.closureCertificateDigest,closurePolicyVersion:"superseded-policy",providerEffectRealityRevision:7};
const candidate={candidateReference:record.candidateReference,executionId:record.executionId,creatorTurnId:record.creatorTurnId,principalId:record.principalId,projectId:record.projectId,reservationId:record.reservationId,requestDigest:record.requestDigest,resultDigest:record.resultDigest,resultPayload:record.resultPayload};
const authority=createMovieMentorCanonicalResultAuthority({store:{readByExecution:async()=>record,commit:async()=>{throw new Error("read court must not commit");}},assertCurrentClosure:async()=>current,readResultCandidate:async()=>candidate});
const result=await authority.readResult({executionId:record.executionId});
assert.notEqual(result.authorized,true,"canonical read must not authorize a durable result when current closure evidence carries superseded policy provenance");
console.log("GREEN: canonical read refuses superseded closure-policy authority.");
console.log("LAW: CURRENT REALITY IS NOT CURRENT POLICY UNLESS THIS BOUNDARY PROVES BOTH.");
