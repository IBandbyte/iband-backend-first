import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN as DOMAIN,MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
// Actual production stageCandidate transaction, isolated real MongoDB, forced reference collision only.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_reference_production_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db;
 const states=db.collection("movie_mentor_creator_state");
 const executions=db.collection("movie_mentor_inference_execution");
 const candidates=db.collection("movie_mentor_result_candidate");
 await states.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await executions.createIndex({executionId:1},{unique:true});
 const expiry=new Date(Date.now()+600000);
 const make=i=>({
  execution:{authorized:true,executionAuthorized:true,executionId:"exec-"+i,creatorTurnId:"turn-"+i,principalId:"principal-"+i,projectId:"project-"+i,reservationId:"reservation-"+i,requestDigest:"digest-"+i,ownerId:"owner-"+i,leaseGeneration:1,leaseReference:"lease-"+i,fencingToken:"fence-"+i},
  proof:{domain:DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:"principal-"+i,projectId:"project-"+i,ownershipRef:"ownership-"+i,ownershipRevision:1,stage:"result-candidate",revision:7,creatorStateGeneration:3,creatorStateFingerprint:"fingerprint-"+i,executionId:"exec-"+i,providerCallId:null}
 });
 for(const i of ["A","B"]){
  const {execution,proof}=make(i);
  await states.insertOne({projectId:execution.projectId,revision:proof.revision,creatorStateGeneration:proof.creatorStateGeneration,creatorStateFingerprint:proof.creatorStateFingerprint,resultCandidateBarrierRevision:0});
  await executions.insertOne({...execution,schema:6,phase:"active",leaseExpiresAt:expiry,resultCandidateBarrierRevision:0});
 }
 const store=createMovieMentorResultCandidateMongoStore({randomId:()=>"fixed-physical-index-collision"});
 const first=make("A"),second=make("B");
 const winner=await store.stageCandidate({execution:first.execution,creatorStateConsumptionProof:first.proof,resultPayload:{value:"first"}});
 assert.equal(winner.executionId,"exec-A");
 let observed;
 try{
  const result=await store.stageCandidate({execution:second.execution,creatorStateConsumptionProof:second.proof,resultPayload:{value:"second"}});
  observed={status:"returned",idempotent:result?.idempotent===true,executionId:result?.executionId};
 }catch(error){
  observed={status:"rejected",code:error.code??null,message:error.message,labels:error.errorLabels??[]};
 }
 const rows=await candidates.find({}, {projection:{_id:0,executionId:1,candidateReference:1}}).toArray();
 const b=await candidates.findOne({executionId:"exec-B"});
 const stateB=await states.findOne({projectId:"project-B"});
 const executionB=await executions.findOne({executionId:"exec-B"});
 const facts={court:"production-stageCandidate-real-reference-duplicate-key",classification:"real isolated MongoDB through production stageCandidate; deterministic candidate reference injection; not a stale lease race",observed,candidateCount:rows.length,rows,loserCandidatePresent:!!b,loserCreatorBarrierRevision:stateB.resultCandidateBarrierRevision,loserExecutionBarrierRevision:executionB.resultCandidateBarrierRevision};
 console.log(JSON.stringify(facts));
 assert.equal(observed.status,"rejected","Production must never return success on unrelated candidate-reference collision");
 assert.equal(observed.code,"MOVIE_MENTOR_RESULT_CANDIDATE_CONFLICT","Production must classify physical duplicate key as conflict");
 assert.equal(rows.length,1);
 assert.equal(rows[0].executionId,"exec-A");
 assert.equal(b,null);
 assert.equal(stateB.resultCandidateBarrierRevision,0,"Failed transaction must roll back creator-state barrier");
 assert.equal(executionB.resultCandidateBarrierRevision,0,"Failed transaction must roll back execution barrier");
}finally{await mongoose.disconnect();}
