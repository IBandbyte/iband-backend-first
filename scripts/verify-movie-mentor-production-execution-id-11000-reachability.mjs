import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN as DOMAIN,MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
// Real production store, real MongoDB 7 replica set, no injected failures or model shortcuts.
// A 11000-free run is explicitly INCONCLUSIVE for the suspected 11000 recovery bypass.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_execution_id_11000_court");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,monitorCommands:true,maxPoolSize:30});
const events=[];
const duplicateIndexes=[];
const client=mongoose.connection.getClient();
for(const type of ["commandStarted","commandFailed","commandSucceeded"])client.on(type,e=>{
 if(["insert","update","commitTransaction","abortTransaction"].includes(e.commandName))
  {events.push({type,command:e.commandName,code:e.failure?.code??null,writeErrors:(e.reply?.writeErrors??[]).map(x=>x.code)});for(const w of e.reply?.writeErrors??[])if(w.code===11000)duplicateIndexes.push(w.errmsg??"");if(e.failure?.code===11000)duplicateIndexes.push(e.failure.message??"");}
});
try{
 const db=mongoose.connection.db;
 const states=db.collection("movie_mentor_creator_state");
 const executions=db.collection("movie_mentor_inference_execution");
 const candidates=db.collection("movie_mentor_result_candidate");
 await states.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await executions.createIndex({executionId:1},{unique:true});
 const store=createMovieMentorResultCandidateMongoStore();
 const summary={court:"production-execution-id-11000-reachability",attempts:0,staleIdempotent:0,staleFenced:0,otherRejected:{},duplicateKeyObserved:false,command11000:0,command112:0,command251:0,barrierViolations:0,candidateViolations:0};
 for(let n=0;n<24;n++){
  const id="matching-11000-"+n;
  const execution={authorized:true,executionAuthorized:true,executionId:id,creatorTurnId:"turn-"+id,principalId:"principal-"+id,projectId:"project-"+id,reservationId:"reservation-"+id,requestDigest:"digest-"+id,ownerId:"owner-A",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"fence-A"};
  const proof={domain:DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:execution.principalId,projectId:execution.projectId,ownershipRef:"ownership-"+id,ownershipRevision:1,stage:"result-candidate",revision:7,creatorStateGeneration:3,creatorStateFingerprint:"fingerprint-"+id,executionId:id,providerCallId:null};
  await states.insertOne({projectId:execution.projectId,revision:7,creatorStateGeneration:3,creatorStateFingerprint:proof.creatorStateFingerprint,resultCandidateBarrierRevision:0});
  await executions.insertOne({...execution,schema:6,phase:"active",leaseExpiresAt:new Date(Date.now()+600000),resultCandidateBarrierRevision:0});
  const payload={value:"matching",iteration:n};
  // Simultaneous real staging; MongoDB determines whether collisions are 112, 11000 or retries.
  const concurrent=await Promise.allSettled(Array.from({length:12},()=>store.stageCandidate({execution,creatorStateConsumptionProof:proof,resultPayload:payload})));
  const rows=await candidates.find({executionId:id}).toArray();
  assert.ok(rows.length<=1,"Physical unique candidate identity must hold");
  const beforeState=await states.findOne({projectId:execution.projectId});
  const beforeExecution=await executions.findOne({executionId:id});
  await executions.updateOne({executionId:id,ownerId:"owner-A",leaseGeneration:1},{$set:{ownerId:"owner-B",leaseGeneration:2,leaseReference:"lease-B",fencingToken:"fence-B"}});
  const stale=await Promise.allSettled(Array.from({length:4},()=>store.stageCandidate({execution,creatorStateConsumptionProof:proof,resultPayload:payload})));
  for(const item of stale){
   summary.attempts++;
   if(item.status==="fulfilled"&&item.value?.idempotent===true)summary.staleIdempotent++;
   else if(item.status==="rejected"){
    const code=item.reason?.code??"unknown";
    if(code==="MOVIE_MENTOR_RESULT_CANDIDATE_EXECUTION_FENCED")summary.staleFenced++;
    else summary.otherRejected[code]=(summary.otherRejected[code]??0)+1;
   }else throw Error("Unexpected stale-owner successful non-idempotent staging");
  }
  const afterState=await states.findOne({projectId:execution.projectId});
  const afterExecution=await executions.findOne({executionId:id});
  if(afterState.resultCandidateBarrierRevision!==beforeState.resultCandidateBarrierRevision||afterExecution.resultCandidateBarrierRevision!==beforeExecution.resultCandidateBarrierRevision)summary.barrierViolations++;
  if((await candidates.countDocuments({executionId:id}))!==rows.length)summary.candidateViolations++;
  assert.equal(afterExecution.ownerId,"owner-B");
  assert.equal(afterExecution.leaseGeneration,2);
  // Concurrent pre-takeover failures are classified, not treated as a fabricated 11000.
  for(const item of concurrent)if(item.status==="rejected"){const code=item.reason?.code??"unknown";summary.otherRejected[code]=(summary.otherRejected[code]??0)+1;}
 }
 for(const e of events)for(const code of [e.code,...e.writeErrors]){
  if(code===11000)summary.command11000++;
  if(code===112)summary.command112++;
  if(code===251)summary.command251++;
 }
 summary.duplicateKeyObserved=summary.command11000>0;
 summary.executionId11000=duplicateIndexes.filter(x=>/index: executionId_1/.test(x)).length;
 summary.candidateReference11000=duplicateIndexes.filter(x=>/index: candidateReference_1/.test(x)).length;
 summary.unclassified11000=duplicateIndexes.filter(x=>!/index: (executionId_1|candidateReference_1)/.test(x)).length;
 summary.sameExecutionRaceAttempts=24*12;
 summary.classification=summary.staleIdempotent>0?"GENUINE_RED_STALE_OWNER_RETURNED_IDEMPOTENT":summary.executionId11000>0?"EXECUTION_ID_11000_OBSERVED_NO_STALE_SUCCESS":"INCONCLUSIVE_NO_EXECUTION_ID_11000";
 console.log(JSON.stringify(summary));
 assert.equal(summary.staleIdempotent,0,"GENUINE RED: stale owner returned idempotent success");
 assert.equal(summary.barrierViolations,0,"GENUINE RED: stale owner mutated authority barriers");
 assert.equal(summary.candidateViolations,0,"GENUINE RED: stale owner inserted another candidate");
}finally{await mongoose.disconnect();}
