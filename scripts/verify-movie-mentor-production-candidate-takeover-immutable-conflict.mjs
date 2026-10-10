import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN as DOMAIN,MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
// Real production store and physical MongoDB. No mocked errors or injected model shortcut.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_takeover_immutable_conflict_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,monitorCommands:true});
const commands=[];
const client=mongoose.connection.getClient();
for(const event of ['commandStarted','commandFailed','commandSucceeded'])client.on(event,e=>{if(['find','update','insert','commitTransaction','abortTransaction'].includes(e.commandName))commands.push({event,command:e.commandName,code:e.failure?.code??null,writeErrors:(e.reply?.writeErrors??[]).map(w=>w.code),transactionStart:e.command?.startTransaction===true});});
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
 const store=createMovieMentorResultCandidateMongoStore();
 const payload={value:"unchanged"};
 const winner=await store.stageCandidate({execution,creatorStateConsumptionProof:proof,resultPayload:payload});
 assert.equal(winner.executionId,execution.executionId);
 await executions.updateOne({executionId:execution.executionId},{$set:{ownerId:"owner-B",leaseGeneration:2,leaseReference:"lease-B",fencingToken:"fence-B"}});
 const newOwner={...execution,ownerId:"owner-B",leaseGeneration:2,leaseReference:"lease-B",fencingToken:"fence-B"};
 const insertsBefore=commands.filter(x=>x.event==="commandStarted"&&x.command==="insert").length;
 const newOwnerResult=await store.stageCandidate({execution:newOwner,creatorStateConsumptionProof:proof,resultPayload:payload});
 assert.equal(newOwnerResult.idempotent,true,"Current owner must read existing matching candidate idempotently");
 const insertsAfter=commands.filter(x=>x.event==="commandStarted"&&x.command==="insert").length;
 assert.equal(insertsAfter,insertsBefore,"Matching candidate must not reach second insert");
 const stateBeforeConflict=await states.findOne({projectId:execution.projectId});
 const executionBeforeConflict=await executions.findOne({executionId:execution.executionId});
 const insertBeforeConflict=commands.filter(x=>x.event==="commandStarted"&&x.command==="insert").length;
 let conflictingResult;
 try{const result=await store.stageCandidate({execution:newOwner,creatorStateConsumptionProof:proof,resultPayload:{value:"different-after-takeover"}});conflictingResult={status:"returned",idempotent:result?.idempotent===true};}
 catch(error){conflictingResult={status:"rejected",code:error.code??null};}
 const insertAfterConflict=commands.filter(x=>x.event==="commandStarted"&&x.command==="insert").length;
 const stateAfterConflict=await states.findOne({projectId:execution.projectId});
 const executionAfterConflict=await executions.findOne({executionId:execution.executionId});
 assert.equal(conflictingResult.status,"rejected","Current owner cannot replace immutable candidate");
 assert.equal(conflictingResult.code,"MOVIE_MENTOR_RESULT_CANDIDATE_CONFLICT");
 assert.equal(insertAfterConflict-insertBeforeConflict,0,"Conflicting candidate must be rejected before insert");
 assert.equal(stateAfterConflict.resultCandidateBarrierRevision,stateBeforeConflict.resultCandidateBarrierRevision,"Conflicting candidate cannot advance creator barrier");
 assert.equal(executionAfterConflict.resultCandidateBarrierRevision,executionBeforeConflict.resultCandidateBarrierRevision,"Conflicting candidate cannot advance execution barrier");
 const concurrent=await Promise.allSettled([store.stageCandidate({execution,creatorStateConsumptionProof:proof,resultPayload:payload}),executions.updateOne({executionId:execution.executionId,ownerId:'owner-B',leaseGeneration:2},{$set:{ownerId:'owner-C',leaseGeneration:3,leaseReference:'lease-C',fencingToken:'fence-C'}})]);
 const concurrentObserved=concurrent.map(x=>x.status==='fulfilled'?{status:'fulfilled',idempotent:x.value?.idempotent===true}:{status:'rejected',code:x.reason?.code??null});
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
 const facts={court:"production-stageCandidate-takeover-immutable-conflict",classification:"real production stale-owner staging concurrently with owner-B to owner-C takeover, followed by guaranteed post-takeover stale readback; not forced duplicate-key recovery",observed,conflictingResult,conflictNewInserts:insertAfterConflict-insertBeforeConflict,conflictCreatorBarrierUnchanged:stateAfterConflict.resultCandidateBarrierRevision===stateBeforeConflict.resultCandidateBarrierRevision,conflictExecutionBarrierUnchanged:executionAfterConflict.resultCandidateBarrierRevision===executionBeforeConflict.resultCandidateBarrierRevision,currentOwnerIdempotent:newOwnerResult.idempotent===true,matchingReadbackNewInserts:insertsAfter-insertsBefore,concurrentObserved,commandFailures:commands.filter(x=>x.event==="commandFailed"),writeReplyErrors:commands.filter(x=>x.event==="commandSucceeded"&&x.writeErrors.length>0),duplicateKeyObserved:commands.some(x=>x.code===11000||x.writeErrors.includes(11000)),transactionStarts:commands.filter(x=>x.transactionStart).length,matchingDurableCandidate:rows.length===1,owner:afterExecution.ownerId,leaseGeneration:afterExecution.leaseGeneration,creatorBarrierUnchanged:afterState.resultCandidateBarrierRevision===beforeState.resultCandidateBarrierRevision,executionBarrierUnchanged:afterExecution.resultCandidateBarrierRevision===beforeExecution.resultCandidateBarrierRevision};
 console.log(JSON.stringify(facts));
 assert.equal(facts.matchingReadbackNewInserts,0);
 assert.equal(observed.status,"rejected","Stale owner must not receive idempotent candidate");
 assert.equal(observed.code,"MOVIE_MENTOR_RESULT_CANDIDATE_EXECUTION_FENCED");
 assert.equal(rows.length,1);
 assert.equal(afterExecution.ownerId,"owner-C");
 assert.equal(afterExecution.leaseGeneration,3);
 assert.equal(facts.creatorBarrierUnchanged,true);
 assert.equal(facts.duplicateKeyObserved,false,"Unexpected duplicate-key under stale owner: investigate physical matching readback before any repair");
 assert.equal(facts.executionBarrierUnchanged,true);
}finally{await mongoose.disconnect();}
