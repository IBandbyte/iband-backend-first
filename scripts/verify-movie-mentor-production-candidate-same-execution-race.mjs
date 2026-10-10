import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorResultCandidateMongoStore} from "../ai/MovieMentorResultCandidateMongoStore.js";
import {MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_PROOF_DOMAIN as DOMAIN,MOVIE_MENTOR_CREATOR_STATE_CONSUMPTION_SCHEMA as SCHEMA} from "../ai/MovieMentorCreatorStateConsumptionAuthority.js";
// Real MongoDB and unmodified production stageCandidate. Classify observed errors; do not manufacture 11000.
const uri=process.env.MONGO_URI;
assert.equal(uri,"mongodb://127.0.0.1:27017/iband_candidate_same_execution_race");
await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,states=db.collection("movie_mentor_creator_state"),executions=db.collection("movie_mentor_inference_execution"),candidates=db.collection("movie_mentor_result_candidate");
 await states.createIndex({projectId:1},{unique:true,partialFilterExpression:{projectId:{$type:"string"}}});
 await executions.createIndex({executionId:1},{unique:true});
 const outcomes=[];
 for(let i=0;i<12;i++){
  const id=String(i);
  const execution={authorized:true,executionAuthorized:true,executionId:"exec-"+id,creatorTurnId:"turn-"+id,principalId:"principal-"+id,projectId:"project-"+id,reservationId:"reservation-"+id,requestDigest:"digest-"+id,ownerId:"owner-A",leaseGeneration:1,leaseReference:"lease-A",fencingToken:"fence-A"};
  const proof={domain:DOMAIN,schema:SCHEMA,authorized:true,currentOwnershipVerified:true,principalId:execution.principalId,projectId:execution.projectId,ownershipRef:"ownership-"+id,ownershipRevision:1,stage:"result-candidate",revision:7,creatorStateGeneration:3,creatorStateFingerprint:"fingerprint-"+id,executionId:execution.executionId,providerCallId:null};
  await states.insertOne({projectId:execution.projectId,revision:7,creatorStateGeneration:3,creatorStateFingerprint:proof.creatorStateFingerprint,resultCandidateBarrierRevision:0});
  await executions.insertOne({...execution,schema:6,phase:"active",leaseExpiresAt:new Date(Date.now()+600000),resultCandidateBarrierRevision:0});
  const a=createMovieMentorResultCandidateMongoStore(),b=createMovieMentorResultCandidateMongoStore();
  const input={execution,creatorStateConsumptionProof:proof,resultPayload:{value:"same"}};
  const pair=await Promise.allSettled([a.stageCandidate(input),b.stageCandidate(input)]);
  const labels=pair.map(p=>p.status==="fulfilled"?{status:"fulfilled",idempotent:p.value?.idempotent===true}:{status:"rejected",code:p.reason?.code??null,codeName:p.reason?.codeName??null,labels:p.reason?.errorLabels??[]});
  const count=await candidates.countDocuments({executionId:execution.executionId});
  assert.equal(count,1,"Concurrent production calls must leave exactly one durable candidate");
  assert.equal(labels.some(x=>x.status==="fulfilled"),true,"At least one production stage must commit");
  outcomes.push({trial:i,results:labels});
 }
 const errors=outcomes.flatMap(o=>o.results.filter(x=>x.status==="rejected"));
 const facts={court:"production-stageCandidate-same-execution-physical-race",classification:"12 isolated same-execution concurrent calls through production stageCandidate; natural scheduling; not a stale lease takeover and not guaranteed duplicate-key coverage",trials:outcomes.length,errors,results:outcomes};
 console.log(JSON.stringify(facts));
 assert.equal(outcomes.length,12);
}finally{await mongoose.disconnect();}
