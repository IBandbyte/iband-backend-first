import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN as DOMAIN,MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
// Real production store and physical MongoDB. No mocked errors or injected model shortcut.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_matching_11000_probe");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,monitorCommands:true});
const failed=[];const client=mongoose.connection.getClient();client.on('commandFailed',e=>{if(['insert','update','find'].includes(e.commandName))failed.push({command:e.commandName,code:e.failure?.code??null});});
try{
 const db=mongoose.connection.db;
 const states=db.collection("movie_mentor_creator_state");
 const executions=db.collection("movie_mentor_inference_execution");
 const candidates=db.collection("movie_mentor_result_candidate");
 await states.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await executions.createIndex({executionId:1},{unique:true});
 const execution={authorized:true,executionAuthorized:true,executionId:"exec-A",creatorTurnId:"turn-A",principalId:"principal-A",projectId:"project-A",reservationId:"reservation-A",requestDigest:"digest-A",ownerId:"owner-A",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"fence-A"};
 const proof={domain:DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:execution.principalId,projectId:execution.projectId,ownershipRef:"ownership-A",ownershipRevision:1,stage:"result-candidate",revision:7,creatorStateGeneration:3,creatorStateFingerprint:"fingerprint-A",executionId:execution.executionId,providerCallId:null};
 await states.insertOne({projectId:execution.projectId,revision:proof.revision,creatorStateGeneration:proof.creatorStateGeneration,creatorStateFingerprint:proof.creatorStateFingerprint,resultCandidateBarrierRevision:0});
 await executions.insertOne({...execution,schema:6,phase:"active",leaseExpiresAt:new Date(Date.now()+600000),resultCandidateBarrierRevision:0});
 const store=createMovieMentorResultCandidateMongoStore({randomId:()=> 'same-execution-fixed-reference'});
 const payload={value:"unchanged"};
 const winner=await store.stageCandidate({execution,creatorStateConsumptionProof:proof,resultPayload:payload});
 assert.equal(winner.executionId,execution.executionId);
 await executions.updateOne({executionId:execution.executionId},{$set:{ownerId:"owner-B",leaseGeneration:2,leaseReference:"lease-B",fencingToken:"fence-B"}});
 const beforeState=await states.findOne({projectId:execution.projectId});
 const beforeExecution=await executions.findOne({executionId:execution.executionId});
 let observed;
 try{
  const result=await store.stageCandidate({execution,creatorStateConsumptionProof:proof,resultPayload:payload});
  observed={status:"returned",idempotent:result?.idempotent===true,executionId:result?.executionId};
 }catch(error){observed={status:"rejected",code:error.code??null};}
 const afterState=await states.findOne({projectId:execution.projectId});
 const afterExecution=await executions.findOne({executionId:execution.executionId});
 const rows=await candidates.find({executionId:execution.executionId}).toArray();
 const facts={court:"production-stageCandidate-matching-11000-reachability-probe",classification:"same-execution matching candidate and deterministic reference reuse after lease takeover; physical probe of whether normal transaction reaches insert/11000, not exhaustive reachability proof",observed,commandFailures:failed,duplicateKeyObserved:failed.some(x=>x.code===11000),matchingDurableCandidate:rows.length===1,owner:afterExecution.ownerId,leaseGeneration:afterExecution.leaseGeneration,creatorBarrierUnchanged:afterState.resultCandidateBarrierRevision===beforeState.resultCandidateBarrierRevision,executionBarrierUnchanged:afterExecution.resultCandidateBarrierRevision===beforeExecution.resultCandidateBarrierRevision};
 console.log(JSON.stringify(facts));
 assert.equal(observed.status,"rejected","Stale owner must not receive idempotent candidate");
 assert.equal(observed.code,"MOVIE_MENTOR_RESULT_CANDIDATE_EXECUTION_FENCED");
 assert.equal(rows.length,1);
 assert.equal(afterExecution.ownerId,"owner-B");
 assert.equal(afterExecution.leaseGeneration,2);
 assert.equal(facts.creatorBarrierUnchanged,true);
 assert.equal(facts.executionBarrierUnchanged,true);
 assert.equal(facts.duplicateKeyObserved,false,"Normal stale-owner readback should fail at lease barrier before insert");
}finally{await mongoose.disconnect();}
