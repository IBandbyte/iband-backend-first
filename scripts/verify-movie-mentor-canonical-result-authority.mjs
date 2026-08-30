import assert from "node:assert/strict";
import { createMovieMentorCanonicalResultAuthority } from "../ai/MovieMentorCanonicalResultAuthority.js";

const results=new Map();let execution={executionId:"exec-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-digest",phase:"closed",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1"};
const store={async readByExecution(id){return results.get(id)||null;},async commit(record){if(results.has(record.executionId))return results.get(record.executionId);const frozen=Object.freeze({...record});results.set(record.executionId,frozen);return frozen;}};
const authority=createMovieMentorCanonicalResultAuthority({store,readExecution:async id=>id===execution.executionId?execution:null,now:()=>new Date("2026-08-30T12:00:00.000Z"),randomId:()=>"result-1"});
const closure={authorized:true,closed:true,executionId:"exec-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1"};
const payload={response:{message:"Creator result"},metadata:{agent:"mentor"}};
const first=await authority.commitResult({closure,result:payload});assert.equal(first.authorized,true);assert.equal(first.committed,true);assert.equal(first.idempotent,false);assert.equal(first.reservationId,"reservation-1");assert.equal(first.resultReference,"canonical-result-result-1");assert.ok(first.resultDigest);
const replay=await authority.commitResult({closure,result:{metadata:{agent:"mentor"},response:{message:"Creator result"}}});assert.equal(replay.idempotent,true);assert.equal(replay.resultDigest,first.resultDigest);assert.equal(replay.resultReference,first.resultReference);
await assert.rejects(()=>authority.commitResult({closure,result:{response:{message:"different"}}}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_CONFLICT");
execution={...execution,phase:"quarantined",quarantineReason:"late-provider-effect-conflict"};const stale=await authority.readResult({executionId:"exec-1"});assert.equal(stale.authorized,false);assert.equal(stale.committed,true);assert.equal(stale.reason,"canonical-result-current-closure-invalid");
await assert.rejects(()=>authority.commitResult({closure,result:payload}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_CLOSURE_STALE");
execution={...execution,phase:"closed",closureReference:"closure-1",closureCertificateDigest:"closure-digest-2"};const invalidated=await authority.readResult({executionId:"exec-1"});assert.equal(invalidated.authorized,false);assert.equal(invalidated.reason,"canonical-result-current-closure-invalid");
execution={...execution,closureCertificateDigest:"closure-digest-1"};const current=await authority.readResult({executionId:"exec-1"});assert.equal(current.authorized,true);assert.equal(current.resultDigest,first.resultDigest);
console.log("GREEN: canonical result is immutable, closure-bound, replayable, conflict-fenced, and invalidated by current closure catastrophe.");
console.log("LAW: CLOSED EXECUTION IS NECESSARY BUT NOT SUFFICIENT; ONLY AN IMMUTABLE CURRENT CLOSURE-BOUND RESULT MAY BECOME CREATOR RESULT AUTHORITY.");
