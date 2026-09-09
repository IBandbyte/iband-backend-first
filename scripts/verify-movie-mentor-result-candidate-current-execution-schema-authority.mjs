import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

function query(value){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function session(){return{async withTransaction(fn){await fn();},async endSession(){}};}

const Candidate=mongoose.models.MovieMentorResultCandidate||mongoose.model("MovieMentorResultCandidate",new mongoose.Schema({}, {strict:false}));
let candidateRow=null;
Candidate.findOne=()=>query(candidateRow);
Candidate.create=async(records)=>{const value=Array.isArray(records)?records[0]:records;candidateRow=structuredClone(value);return Array.isArray(records)?[structuredClone(candidateRow)]:structuredClone(candidateRow);};

const executionBase={authorized:true,executionAuthorized:true,executionId:"execution-schema-court",creatorTurnId:"turn-schema-court",principalId:"creator-schema-court",projectId:"project-schema-court",reservationId:"reservation-schema-court",requestDigest:"request-schema-court",ownerId:"owner-schema-court",leaseGeneration:7,leaseReference:"lease-schema-court",fencingToken:"fence-schema-court"};
const stateProof={domain:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,schema:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:executionBase.principalId,projectId:executionBase.projectId,ownershipRef:"ownership-schema-court",ownershipRevision:3,stage:"result-candidate",revision:9,creatorStateGeneration:4,creatorStateFingerprint:"creator-state-schema-court",executionId:executionBase.executionId,providerCallId:null};
const payload={success:true,mentorResponse:{text:"schema court"}};

async function attempt(durableSchema){
  candidateRow=null;
  let executionBarrierFilter=null;
  const executionCollection={async updateOne(filter){executionBarrierFilter=structuredClone(filter);return{matchedCount:filter.schema===durableSchema?1:0};}};
  const creatorStateCollection={async updateOne(){return{matchedCount:1};}};
  const store=createMovieMentorResultCandidateMongoStore({connect:async()=>null,executionCollection,creatorStateCollection,startSession:async()=>session(),now:()=>new Date("2035-01-01T00:00:00.000Z"),randomId:()=>`schema-${durableSchema}`});
  const execution={...executionBase,schema:durableSchema};
  try{return{ok:true,result:await store.stageCandidate({execution,resultPayload:payload,creatorStateConsumptionProof:stateProof}),executionBarrierFilter};}
  catch(error){return{ok:false,error,executionBarrierFilter};}
}

const current=await attempt(6);
assert.equal(current.ok,true,"current schema-6 execution must stage a result candidate");
assert.equal(current.executionBarrierFilter?.schema,6,"candidate store must independently bind the atomic execution fence to current schema 6");

const legacy=await attempt(5);
assert.equal(legacy.ok,false,"legacy execution schema must not cross the irreversible result-candidate staging boundary");
assert.equal(legacy.executionBarrierFilter?.schema,6,"legacy caller evidence must not choose the durable schema admitted by the candidate store");
assert.equal(legacy.error?.code,"MOVIE_MENTOR_RESULT_CANDIDATE_EXECUTION_FENCED");

console.log("GREEN: result-candidate staging independently proves current execution schema at its atomic durable boundary.");
console.log("LAW: CURRENT LEASE AUTHORITY CANNOT LEND CURRENT-SCHEMA AUTHORITY TO RESULT-CANDIDATE STAGING.");
