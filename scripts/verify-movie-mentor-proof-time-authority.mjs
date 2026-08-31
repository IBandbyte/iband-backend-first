import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createMovieMentorInferenceExecutionClosureAuthority} from "../ai/MovieMentorInferenceExecutionClosureAuthority.js";
import {createMovieMentorInferenceSpendMongoStore} from "../ai/MovieMentorInferenceSpendMongoStore.js";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {createMovieMentorCanonicalResultMongoStore} from "../ai/MovieMentorCanonicalResultMongoStore.js";

const closureStore={
  readExecution:async()=>({phase:"active",executionId:"e",ownerId:"o",leaseGeneration:1,leaseReference:"l",fencingToken:"f",leaseExpiresAt:"2032-01-01T00:10:00.000Z",providerCalls:[],providerCallsClaimed:0}),
  beginClosing:async()=>null,recoverExpiredIntoClosing:async()=>null,completeClosing:async()=>null,quarantineExecution:async()=>null
};
const effectStore={readEffect:async()=>null};
const closure=createMovieMentorInferenceExecutionClosureAuthority({store:closureStore,effectStore,now:()=>null});
await assert.rejects(()=>closure.beginClosing({execution:{authorized:true,executionId:"e",ownerId:"o",leaseGeneration:1,leaseReference:"l",fencingToken:"f"}}),e=>e.code==="MOVIE_MENTOR_INFERENCE_CLOSURE_TIME_INVALID");

function reservationModel(row){return{findOne(){return{lean(){return{exec:async()=>row}}}}};}
const spendBase={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId:"r",principalId:"p",projectId:"pr",operation:"movie-mentor-turn",units:1,entitlementRevision:1,status:"reserved",reservedAt:"2032-01-01T00:00:00.000Z",settledAt:null};
const validSpend=createMovieMentorInferenceSpendMongoStore({models:{reservationModel:reservationModel(spendBase),entitlementModel:{}},connect:async()=>{}});
assert.equal((await validSpend.readReservation("r")).reservedAt,"2032-01-01T00:00:00.000Z");
const missingSpend=createMovieMentorInferenceSpendMongoStore({models:{reservationModel:reservationModel({...spendBase,reservedAt:null}),entitlementModel:{}},connect:async()=>{}});
await assert.rejects(()=>missingSpend.readReservation("r"),e=>e.code==="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID");
const invalidSettled=createMovieMentorInferenceSpendMongoStore({models:{reservationModel:reservationModel({...spendBase,settledAt:"not-a-date"}),entitlementModel:{}},connect:async()=>{}});
await assert.rejects(()=>invalidSettled.readReservation("r"),e=>e.code==="MOVIE_MENTOR_INFERENCE_SPEND_RESERVATION_INVALID");

const payload={response:"x"};const resultDigest=crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
const candidateRow={domain:"iband.movie-mentor.result-candidate-store",schema:1,candidateReference:"c",executionId:"e",creatorTurnId:"t",principalId:"p",projectId:"pr",reservationId:"r",requestDigest:"q",resultDigest,resultPayload:payload,stagedFromLeaseGeneration:1,stagedFromLeaseReference:"l",stagedFromFencingToken:"f",stagedAt:null};
const candidateModel={findOne(){return{lean(){return{exec:async()=>candidateRow}}}}};
const candidateStore=createMovieMentorResultCandidateMongoStore({mongoModel:candidateModel,executionCollection:false});
await assert.rejects(()=>candidateStore.readByExecution("e"),e=>e.code==="MOVIE_MENTOR_RESULT_CANDIDATE_RECORD_INVALID");

const canonicalRow={domain:"iband.movie-mentor.canonical-result-store",schema:2,resultReference:"rr",candidateReference:"c",executionId:"e",creatorTurnId:"t",principalId:"p",projectId:"pr",reservationId:"r",requestDigest:"q",closureReference:"cl",closureCertificateDigest:"cd",resultDigest:"d",resultPayload:{},committedAt:null};
const canonicalModel={findOne(){return{lean(){return{exec:async()=>canonicalRow}}}}};
const canonicalStore=createMovieMentorCanonicalResultMongoStore({mongoModel:canonicalModel,executionCollection:false});
await assert.rejects(()=>canonicalStore.readByExecution("e"),e=>e.code==="MOVIE_MENTOR_CANONICAL_RESULT_RECORD_INVALID");

console.log("5A.24 durable proof-time catastrophe gate: GREEN");
console.log("LAW: ABSENCE IS NOT THE UNIX EPOCH. NO EVENT TIME -> NO DURABLE PROOF.");
