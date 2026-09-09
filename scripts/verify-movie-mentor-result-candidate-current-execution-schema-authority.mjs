import assert from "node:assert/strict";
import { createMovieMentorResultCandidateMongoStore } from "../ai/MovieMentorResultCandidateMongoStore.js";
import { MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN, MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA } from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";

function query(value){return{session(){return this;},lean(){return this;},async exec(){return value?structuredClone(value):null;}};}
function candidateModel(){let row=null;return{findOne(){return query(row);},async create(records){const value=Array.isArray(records)?records[0]:records;row=structuredClone(value);return Array.isArray(records)?[structuredClone(row)]:structuredClone(row);}};}
function session(){return{async withTransaction(fn){await fn();},async endSession(){}};}
const executionBase={authorized:true,executionAuthorized:true,executionId:"execution-schema-court",creatorTurnId:"turn-schema-court",principalId:"creator-schema-court",projectId:"project-schema-court",reservationId:"reservation-schema-court",requestDigest:"request-schema-court",ownerId:"owner-schema-court",leaseGeneration:7,leaseReference:"lease-schema-court",fencingToken:"fence-schema-court"};
const stateProof={domain:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN,schema:MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:executionBase.principalId,projectId:executionBase.projectId,ownershipRef:"ownership-schema-court",ownershipRevision:3,stage:"result-candidate",revision:9,creatorStateGeneration:4,creatorStateFingerprint:"creator-state-schema-court",executionId:executionBase.executionId,providerCallId:null};
const payload={success:true,mentorResponse:{text:"schema court"}};

async function attempt(durableSchema){
  let executionBarrierFilter=null;
  const executionCollection={async updateOne(filter){executionBarrierFilter=structuredClone(filter);const schemaMatches=filter.schema===undefined||filter.schema===durableSchema;return{matchedCount:schemaMatches?1:0};}};
  const creatorStateCollection={async updateOne(){return{matchedCount:1};}};
  const store=createMovieMentorResultCandidateMongoStore({mongoModel:candidateModel(),executionCollection,creatorStateCollection,startSession:async()=>session(),now:()=>new Date("2035-01-01T00:00:00.000Z"),randomId:()=>`schema-${durableSchema}`});
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
