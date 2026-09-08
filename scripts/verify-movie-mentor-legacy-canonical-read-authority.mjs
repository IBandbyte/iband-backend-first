import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createMovieMentorCanonicalResultAuthority } from "../ai/MovieMentorCanonicalResultAuthority.js";

const stable=value=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object"){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;};
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const payload={success:true,text:"legacy history must not become creator-facing current authority"},resultDigest=digest(payload);
const legacyRecord={schema:1,resultReference:"result-legacy-read",candidateReference:null,executionId:"execution-legacy-read",creatorTurnId:"turn-legacy-read",principalId:"creator-legacy-read",projectId:"project-legacy-read",reservationId:"reservation-legacy-read",requestDigest:"request-legacy-read",closureReference:"closure-legacy-read",closureCertificateDigest:"closure-digest-legacy-read",resultDigest,resultPayload:payload,committedAt:"2031-12-31T23:59:59.000Z"};
const current={authorized:true,closed:true,finalized:true,phase:"finalized",currentRealityVerified:true,providerEffectRealityRevision:9,executionId:legacyRecord.executionId,creatorTurnId:legacyRecord.creatorTurnId,principalId:legacyRecord.principalId,projectId:legacyRecord.projectId,reservationId:legacyRecord.reservationId,requestDigest:legacyRecord.requestDigest,closureReference:legacyRecord.closureReference,closureCertificateDigest:legacyRecord.closureCertificateDigest};
const candidate={candidateReference:"candidate-current-read",executionId:legacyRecord.executionId,creatorTurnId:legacyRecord.creatorTurnId,principalId:legacyRecord.principalId,projectId:legacyRecord.projectId,reservationId:legacyRecord.reservationId,requestDigest:legacyRecord.requestDigest,resultDigest,resultPayload:payload};
const authority=createMovieMentorCanonicalResultAuthority({store:{async readByExecution(){return legacyRecord;},async commit(){throw new Error("read court must not commit");}},assertCurrentClosure:async()=>current,readResultCandidate:async()=>candidate});
const result=await authority.readResult({executionId:legacyRecord.executionId});
assert.equal(result.authorized,false,"legacy canonical schema must remain history-only even when neighboring current closure and candidate proofs happen to match");
assert.equal(result.committed,true);
assert.equal(result.reason,"canonical-result-current-schema-required");
assert.equal("resultPayload" in result,false,"history-only canonical rows must not expose creator-facing payload through an authority-shaped response");
console.log("GREEN: legacy canonical history remains readable identity but cannot borrow current closure/candidate proof to become authorized creator-facing result authority.");
console.log("LAW: CURRENT NEIGHBORING PROOFS CANNOT UPGRADE A LEGACY CANONICAL RECORD. HISTORY MAY SURVIVE; AUTHORITY MAY NOT.");
