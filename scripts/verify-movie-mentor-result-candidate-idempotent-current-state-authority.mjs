import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

const stable=v=>{if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object"){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o;}return v;};
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
function query(value){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function session(){return{async withTransaction(fn){await fn();},async endSession(){}};}

const Candidate=mongoose.models.MovieMentorResultCandidate||mongoose.model("MovieMentorResultCandidate",new mongoose.Schema({}, {strict:false}));
const payload={success:true,mentorResponse:{text:"idempotent-current-state-court"}};
const existing={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference:"candidate-existing",executionId:"execution-idempotent",creatorTurnId:"turn-idempotent",principalId:"creator-idempotent",projectId:"project-idempotent",reservationId:"reservation-idempotent",requestDigest:"request-idempotent",resultDigest:digest(payload),resultPayload:payload,stagedFromLeaseGeneration:7,stagedFromLeaseReference:"lease-idempotent",stagedFromFencingToken:"fence-idempotent",creatorStateRevision:9,creatorStateGeneration:4,creatorStateFingerprint:"state-idempotent",creatorStateOwnershipRef:"ownership-idempotent",creatorStateOwnershipRevision:3,stagedAt:new Date("2035-01-01T00:00:00.000Z")};
Candidate.findOne=()=>query(existing);
Candidate.create=async()=>{throw new Error("idempotent court must not create a second candidate");};

const execution={authorized:true,executionAuthorized:true,schema:6,executionId:existing.executionId,creatorTurnId:existing.creatorTurnId,principalId:existing.principalId,projectId:existing.projectId,reservationId:existing.reservationId,requestDigest:existing.requestDigest,ownerId:"owner-idempotent",leaseGeneration:7,leaseReference:existing.stagedFromLeaseReference,fencingToken:existing.stagedFromFencingToken};
const proof={domain:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,schema:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:existing.principalId,projectId:existing.projectId,ownershipRef:existing.creatorStateOwnershipRef,ownershipRevision:existing.creatorStateOwnershipRevision,stage:"result-candidate",revision:existing.creatorStateRevision,creatorStateGeneration:existing.creatorStateGeneration,creatorStateFingerprint:existing.creatorStateFingerprint,executionId:existing.executionId,providerCallId:null};

let stateBarrierCalls=0;
let executionBarrierCalls=0;
let physicalIndexReads=0;
const creatorStateCollection={async updateOne(){stateBarrierCalls+=1;return{matchedCount:0};}};
const executionCollection={async updateOne(){executionBarrierCalls+=1;return{matchedCount:1};}};
const readIndexes=async collectionName=>{physicalIndexReads+=1;assert.equal(collectionName,"movie_mentor_result_candidate","idempotent court must prove the candidate store's own physical collection");return[{key:{executionId:1},unique:true},{key:{candidateReference:1},unique:true}];};
const store=createMovieMentorResultCandidateMongoStore({connect:async()=>null,readIndexes,creatorStateCollection,executionCollection,startSession:async()=>session(),now:()=>new Date("2035-01-01T00:00:01.000Z")});

await assert.rejects(
  ()=>store.stageCandidate({execution,resultPayload:payload,creatorStateConsumptionProof:proof}),
  error=>error?.code==="MOVIE_MENTOR_RESULT_CANDIDATE_CREATOR_STATE_FENCED",
  "an existing idempotent candidate must not bypass the atomic current creator-state barrier after the state universe changed",
);
assert.equal(physicalIndexReads,1,"idempotent candidate recovery must prove owned physical uniqueness before durable read/reuse authority");
assert.equal(stateBarrierCalls,1,"idempotent candidate recovery must re-enter the creator-state atomic barrier exactly once");
assert.equal(executionBarrierCalls,0,"creator-state revocation must fail before execution authority can be reused");

console.log("GREEN: idempotent result-candidate recovery proves owned physical uniqueness and re-earns current creator-state authority at the durable boundary.");
console.log("LAW: IDEMPOTENCY MAY REUSE HISTORY; IT MAY NOT BORROW PHYSICAL UNIQUENESS OR REUSE STALE CREATOR-STATE AUTHORITY.");
