import assert from "node:assert/strict";
import fs from "node:fs";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { createMovieMentorCanonicalResultAuthority } from "../ai/MovieMentorCanonicalResultAuthority.js";
import { MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

const execution = Object.freeze({
  authorized:true,
  executionAuthorized:true,
  executionId:"execution-time",
  creatorTurnId:"turn-time",
  principalId:"creator-time",
  projectId:"project-time",
  reservationId:"reservation-time",
  requestDigest:"request-time",
  ownerId:"owner-time",
  leaseGeneration:1,
  leaseReference:"lease-time",
  fencingToken:"fence-time"
});
const creatorStateConsumptionProof=Object.freeze({
  domain:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,
  schema:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,
  authorized:true,
  currentOwnershipVerified:true,
  principalId:execution.principalId,
  projectId:execution.projectId,
  ownershipRef:"ownership-time",
  ownershipRevision:1,
  stage:"result-candidate",
  revision:2,
  creatorStateGeneration:2,
  creatorStateFingerprint:"creator-state-time",
  executionId:execution.executionId,
  providerCallId:null,
});

const candidateModel = {
  findOne(){ return { lean(){ return { exec:async()=>null }; } }; },
  create:async row=>row,
};
let candidatePhysicalIndexReads=0;
const candidateStore = createMovieMentorResultCandidateMongoStore({
  mongoModel:candidateModel,
  executionCollection:false,
  readIndexes:async collectionName=>{
    candidatePhysicalIndexReads+=1;
    assert.equal(collectionName,"movie_mentor_result_candidate","proof-creation court must prove the candidate store's own physical collection");
    return [{key:{executionId:1},unique:true},{key:{candidateReference:1},unique:true}];
  },
  now:()=>null,
  randomId:()=>"candidate-time"
});
await assert.rejects(
  ()=>candidateStore.stageCandidate({execution,resultPayload:{text:"result"},creatorStateConsumptionProof}),
  error=>error.code==="MOVIE_MENTOR_RESULT_CANDIDATE_TIME_INVALID"
);
assert.equal(candidatePhysicalIndexReads,1,"proof-creation time court must cross owned candidate physical uniqueness before evaluating irreversible staging time");

const candidatePayload={text:"result"};
const closure=Object.freeze({
  authorized:true,
  closed:true,
  currentRealityVerified:true,
  phase:"closed",
  executionId:execution.executionId,
  creatorTurnId:execution.creatorTurnId,
  principalId:execution.principalId,
  projectId:execution.projectId,
  reservationId:execution.reservationId,
  requestDigest:execution.requestDigest,
  closureReference:"closure-time",
  closureCertificateDigest:"certificate-time",
  providerEffectRealityRevision:0
});
let authority;
const canonicalStore={
  readByExecution:async()=>null,
  commit:async()=>{ throw new Error("invalid time must fail before canonical persistence"); }
};
authority=createMovieMentorCanonicalResultAuthority({
  store:canonicalStore,
  assertCurrentClosure:async()=>closure,
  readResultCandidate:async()=>({
    candidateReference:"candidate-time",
    executionId:execution.executionId,
    creatorTurnId:execution.creatorTurnId,
    principalId:execution.principalId,
    projectId:execution.projectId,
    reservationId:execution.reservationId,
    requestDigest:execution.requestDigest,
    resultPayload:candidatePayload,
    resultDigest:authority.digestResult(candidatePayload)
  }),
  now:()=>null,
  randomId:()=>"canonical-time"
});
await assert.rejects(
  ()=>authority.commitResult({closure,result:candidatePayload}),
  error=>error.code==="MOVIE_MENTOR_CANONICAL_RESULT_TIME_INVALID"
);

const settlementSource=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
assert.match(settlementSource,/function settlementInstant\(v\)/);
assert.match(settlementSource,/MOVIE_MENTOR_INFERENCE_SETTLEMENT_TIME_INVALID/);
assert.match(settlementSource,/settlementInstant\(now\(\)\)/);
assert.doesNotMatch(settlementSource,/new Date\(now\(\)\)/);

const candidateSource=fs.readFileSync(new URL("../ai/MovieMentorResultCandidateMongoStore.js",import.meta.url),"utf8");
assert.match(candidateSource,/stagedAt:instant\(now\(\)\)/);
assert.doesNotMatch(candidateSource,/stagedAt:new Date\(now\(\)\)/);

const canonicalAuthoritySource=fs.readFileSync(new URL("../ai/MovieMentorCanonicalResultAuthority.js",import.meta.url),"utf8");
assert.match(canonicalAuthoritySource,/existing\?\.committedAt\|\|instant\(now\(\)\)\.toISOString\(\)/);
assert.doesNotMatch(canonicalAuthoritySource,/new Date\(now\(\)\)\.toISOString\(\)/);

console.log("5A.24 proof creation-time catastrophe gate: GREEN");
console.log("✓ candidate staging proves owned physical uniqueness before refusing an absent clock");
console.log("✓ candidate staging cannot turn an absent clock into 1970 proof");
console.log("✓ canonical result authority cannot turn an absent clock into 1970 proof");
console.log("✓ settlement creation clocks are routed through fail-closed time validation");
console.log("LAW: A READ-TIME VALIDATOR CANNOT SAVE A WRITE-TIME CLOCK THAT ALREADY TURNED ABSENCE INTO HISTORY.");
