import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {createMovieMentorCanonicalResultMongoStore} from "../ai/MovieMentorCanonicalResultMongoStore.js";
import {createMovieMentorCanonicalResultAuthority} from "../ai/MovieMentorCanonicalResultAuthority.js";

const stable=v=>{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object"){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o;}return v;};
const hash=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const payload={response:{message:"Creator result"},metadata:{agent:"mentor"}},resultDigest=hash(payload);
const record={resultReference:"canonical-result-1",candidateReference:"candidate-1",executionId:"exec-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",resultDigest,resultPayload:stable(payload),committedAt:"2032-01-01T00:00:00.000Z"};

let legacyCreates=0;
const legacyModel={findOne(){return{lean(){return{exec:async()=>null};}}},async create(){legacyCreates++;throw new Error("legacy writer must never be reached");}};
const legacyStore=createMovieMentorCanonicalResultMongoStore({mongoModel:legacyModel,executionCollection:false,candidateCollection:false});
await assert.rejects(()=>legacyStore.commit(record,{expectedProviderEffectRealityRevision:7}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_STORE_AUTHORITY_REQUIRED");
assert.equal(legacyCreates,0,"disabled legacy mode must not create a canonical result row");

const closureCurrent=async()=>({authorized:true,closed:true,currentRealityVerified:true,providerEffectRealityRevision:7,phase:"closed",finalized:false,executionId:"exec-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1"});
const candidateReader=async()=>({candidateReference:"candidate-1",executionId:"exec-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",resultDigest,resultPayload:stable(payload)});
const legacyAuthority=createMovieMentorCanonicalResultAuthority({store:legacyStore,assertCurrentClosure:closureCurrent,readResultCandidate:candidateReader,now:()=>new Date(record.committedAt),randomId:()=>"1"});
await assert.rejects(()=>legacyAuthority.commitResult({closure:{authorized:true,closed:true,executionId:"exec-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1"},result:payload}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_STORE_AUTHORITY_REQUIRED");
assert.equal(legacyCreates,0,"neighbour authority proof must not mint store authority");

let canonicalRow=null;
const queryResult=query=>({session(){return this;},lean(){return this;},async exec(){if(!canonicalRow)return null;if(query.executionId&&canonicalRow.executionId!==query.executionId)return null;if(query.principalId&&canonicalRow.principalId!==query.principalId)return null;if(query.projectId&&canonicalRow.projectId!==query.projectId)return null;if(query.creatorTurnId&&canonicalRow.creatorTurnId!==query.creatorTurnId)return null;return canonicalRow;}});
const authoritativeModel={findOne(query){return queryResult(query);},async create(rows){canonicalRow=structuredClone(rows[0]);return[canonicalRow];}};
let executionRow={domain:"iband.movie-mentor.inference-execution-store",schema:6,phase:"closed",providerEffectRealityRevision:7,executionId:"exec-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",closureReference:"closure-1",closureCertificateDigest:"closure-digest-1",resultFinalizationBarrierRevision:0};
let candidateRow={domain:"iband.movie-mentor.result-candidate-store",schema:1,candidateReference:"candidate-1",executionId:"exec-1",creatorTurnId:"turn-1",principalId:"creator-1",projectId:"project-1",reservationId:"reservation-1",requestDigest:"request-1",resultDigest,resultPayload:stable(payload)};
const executionCollection={async findOne(){return structuredClone(executionRow);},async updateOne(filter,update){assert.equal(filter.executionId,"exec-1");assert.equal(filter.phase,"closed");assert.equal(filter.providerEffectRealityRevision,7);executionRow={...executionRow,...structuredClone(update.$set),resultFinalizationBarrierRevision:executionRow.resultFinalizationBarrierRevision+1};return{matchedCount:1};}};
const candidateCollection={async findOne(){return structuredClone(candidateRow);}};
const session={async withTransaction(fn){return fn();},async endSession(){}};
const authoritativeStore=createMovieMentorCanonicalResultMongoStore({mongoModel:authoritativeModel,executionCollection,candidateCollection,startSession:async()=>session});
const committed=await authoritativeStore.commit(record,{expectedProviderEffectRealityRevision:7});
assert.equal(committed.resultReference,"canonical-result-1");
assert.equal(committed.candidateReference,"candidate-1");
assert.equal(executionRow.phase,"finalized");
assert.equal(executionRow.finalizedResultReference,"canonical-result-1");
assert.equal(executionRow.finalizedCandidateReference,"candidate-1");
assert.equal(executionRow.finalizedResultDigest,resultDigest);
assert.equal(executionRow.resultFinalizationBarrierRevision,1);
const replay=await authoritativeStore.commit(record,{expectedProviderEffectRealityRevision:7});
assert.equal(replay.resultReference,"canonical-result-1");
assert.equal(executionRow.resultFinalizationBarrierRevision,1,"idempotent finalized replay must not advance barrier again");
await assert.rejects(()=>authoritativeStore.commit(record,{expectedProviderEffectRealityRevision:6}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_REALITY_STALE");
const originalCandidate=candidateRow;candidateRow={...candidateRow,resultDigest:hash({tampered:true}),resultPayload:{tampered:true}};
await assert.rejects(()=>authoritativeStore.commit(record,{expectedProviderEffectRealityRevision:7}),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_CANDIDATE_LINEAGE_STALE");
candidateRow=originalCandidate;

const source=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultMongoStore.js",import.meta.url),"utf8");
assert.doesNotMatch(source,/commitLegacy/);
assert.doesNotMatch(source,/if\(mongoModel\|\|executionCollection===false\)return/);
assert.match(source,/MOVIE_MENTOR_CANONICAL_RESULT_STORE_AUTHORITY_REQUIRED/);
assert.match(source,/legacyWritePath:"disabled"/);
assert.match(source,/componentAuthority:"store-must-prove-execution-and-candidate-ledgers"/);
assert.match(source,/session\.withTransaction/);
assert.match(source,/candidateLedger\(\)\.findOne/);
assert.match(source,/executionLedger\(\)\.updateOne/);

console.log("5A.24 canonical result store authority boundary gate: GREEN");
console.log("✓ injected/read-only legacy configuration cannot persist canonical result authority");
console.log("✓ caller or neighbouring authority proof cannot bypass the store-owned execution/candidate ledgers");
console.log("✓ fully injected authoritative ledgers still exercise the exact transactional store proof without a live Mongo service");
console.log("✓ exact CLOSED execution, provider-effect revision, durable candidate lineage, and atomic FINALIZED transition remain store-owned proofs");
console.log("LAW: NO COMPONENT GETS CREDIT FOR ITS NEIGHBOUR'S PROOF. NO STORE-OWNED EXECUTION + CANDIDATE LEDGER PROOF -> NO CANONICAL RESULT WRITE AUTHORITY.");
