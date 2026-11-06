import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {createMovieMentorInferenceSettlementMongoStore} from "../ai/MovieMentorInferenceSettlementMongoStore.js";
import {createMovieMentorInferenceSettlementPhysicalAuthority,MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES} from "../ai/MovieMentorInferenceSettlementPhysicalAuthority.js";

const uri=process.env.MOVIE_MENTOR_ISOLATED_MONGO_URI;
assert.match(uri||"",/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\//,"Disposable local Mongo URI required");
process.env.MONGO_URI=uri;
const digest=value=>crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const stableDigest=value=>digest(stable(value));
await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:5000,monitorCommands:true});
try{
 const db=mongoose.connection.db;
 for(const requirement of MOVIE_MENTOR_INFERENCE_SETTLEMENT_REQUIRED_UNIQUE_INDEXES)
  await db.collection(requirement.collection).createIndex(requirement.key,{unique:true});
 const authority=createMovieMentorInferenceSettlementPhysicalAuthority({
  store:createMovieMentorInferenceSettlementMongoStore(),
  readIndexes:collection=>db.collection(collection).indexes()
 });
 const executionId="physical-overlap-execution",creatorTurnId="physical-overlap-turn",principalId="physical-overlap-owner",projectId="physical-overlap-project",reservationId="physical-overlap-reservation",requestDigest="physical-overlap-request";
 const resultReference="physical-overlap-result",candidateReference="physical-overlap-candidate",closureReference="physical-overlap-closure",leaseReference="physical-overlap-lease",fencingToken="physical-overlap-fence";
 const resultPayload={text:"verified rollback fixture"},resultDigest=stableDigest(resultPayload);
 const frozenProviderCallSetDigest=digest([]);
 const certificate={executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,closureReference,frozenProviderCallSetDigest,closurePolicyVersion:"physical-overlap-policy",realities:[]};
 const closureCertificateDigest=digest(certificate);
 const execution={domain:"iband.movie-mentor.inference-execution-store",schema:6,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,phase:"finalized",leaseGeneration:1,leaseReference,fencingToken,providerCallsClaimed:0,providerCalls:[],frozenProviderCallCount:0,frozenProviderCallSetDigest,closureReference,closurePolicyVersion:certificate.closurePolicyVersion,closureCertificateDigest,providerEffectRealityRevision:0,settlementRealityBarrierRevision:0,finalizedResultReference:resultReference,finalizedCandidateReference:candidateReference,finalizedResultDigest:resultDigest,resultFinalizedAt:new Date("2032-01-01T00:03:00.000Z")};
 const result={domain:"iband.movie-mentor.canonical-result-store",schema:2,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,closureReference,closureCertificateDigest,resultReference,candidateReference,resultDigest,resultPayload};
 const candidate={domain:"iband.movie-mentor.result-candidate-store",schema:2,candidateReference,executionId,creatorTurnId,principalId,projectId,reservationId,requestDigest,resultDigest,resultPayload,stagedFromLeaseGeneration:1,stagedFromLeaseReference:leaseReference,stagedFromFencingToken:fencingToken,creatorStateFingerprint:"physical-overlap-state",creatorStateOwnershipRef:"physical-overlap-ownership",creatorStateRevision:0,creatorStateGeneration:1,creatorStateOwnershipRevision:1,stagedAt:new Date("2032-01-01T00:02:00.000Z")};
 const reservation={domain:"iband.movie-mentor.inference-spend",schema:1,reservationId,principalId,projectId,operation:"movie-mentor-turn",status:"reserved",units:2};
 const entitlement={domain:"iband.movie-mentor.inference-spend",schema:1,principalId,reservedUnits:2,consumedUnits:0,remainingUnits:3,entitlementRevision:1};
 const collections={execution:"movie_mentor_inference_execution",result:"movie_mentor_canonical_result",candidate:"movie_mentor_result_candidate",reservation:"movie_mentor_inference_spend_reservation",entitlement:"movie_mentor_inference_entitlement"};
 for(const [key,row] of Object.entries({execution,result,candidate,reservation,entitlement}))await db.collection(collections[key]).insertOne(row);
 const snapshot=async()=>({
  execution:await db.collection(collections.execution).findOne({executionId},{projection:{_id:0}}),
  reservation:await db.collection(collections.reservation).findOne({reservationId},{projection:{_id:0}}),
  entitlement:await db.collection(collections.entitlement).findOne({principalId},{projection:{_id:0}})
 });
 const before=await snapshot();
 assert.equal(before.execution.phase,"finalized");
 assert.equal(before.reservation.status,"reserved");
 assert.equal(before.entitlement.reservedUnits,2);
 const client=mongoose.connection.getClient();
 const updateStarts=[],updateEnds=new Map();
 let resolveFirst,resolveSecond;
 const firstStarted=new Promise(resolve=>{resolveFirst=resolve;});
 const secondStarted=new Promise(resolve=>{resolveSecond=resolve;});
 const onStarted=event=>{
  if(event.commandName!=="update"||event.command?.update!==collections.execution)return;
  const record={requestId:event.requestId,time:process.hrtime.bigint()};
  updateStarts.push(record);
  if(updateStarts.length===1)resolveFirst(record);
  if(updateStarts.length===2)resolveSecond(record);
 };
 const onCompleted=event=>{
  if(event.commandName==="update")updateEnds.set(event.requestId,process.hrtime.bigint());
 };
 client.on("commandStarted",onStarted);
 client.on("commandSucceeded",onCompleted);
 client.on("commandFailed",onCompleted);
 try{
  await db.admin().command({configureFailPoint:"failCommand",mode:{times:1},data:{failCommands:["update"],blockConnection:true,blockTimeMS:1800}});
  const firstAttempt=authority.settleCanonicalResult({executionId});
  await Promise.race([firstStarted,new Promise((_,reject)=>setTimeout(()=>reject(new Error("First execution update never reached Mongo")),5000))]);
  const secondAttempt=authority.settleCanonicalResult({executionId});
  await Promise.race([secondStarted,new Promise((_,reject)=>setTimeout(()=>reject(new Error("Second execution update never reached Mongo")),5000))]);
  const attempts=await Promise.allSettled([firstAttempt,secondAttempt]);
  assert.ok(updateStarts.length>=2,"Both contenders must send execution updates to Mongo");
  const firstEnd=updateEnds.get(updateStarts[0].requestId);
  assert.ok(firstEnd!==undefined,"First Mongo execution update must complete");
  assert.ok(updateStarts[1].time<firstEnd,"Second execution update must enter Mongo before first update completes");
  const fulfilled=attempts.filter(attempt=>attempt.status==="fulfilled").map(attempt=>attempt.value);
  const rejected=attempts.filter(attempt=>attempt.status==="rejected");
  assert.ok(fulfilled.some(outcome=>outcome?.settled===true&&outcome?.authorized===true&&outcome?.idempotent===false),"One competing settlement must durably win the debit");
  assert.ok(fulfilled.every(outcome=>outcome?.settled===true&&outcome?.authorized===true),"No competing attempt may report unauthorized success");
  assert.ok(rejected.every(attempt=>attempt.reason?.code||attempt.reason?.name),"Losing attempt must fail explicitly");
 }finally{
  client.off("commandStarted",onStarted);
  client.off("commandSucceeded",onCompleted);
  client.off("commandFailed",onCompleted);
  await db.admin().command({configureFailPoint:"failCommand",mode:"off"}).catch(()=>{});
 }
 const after=await snapshot();
 assert.equal(after.execution.phase,"settled");
 assert.equal(after.execution.settledResultReference,resultReference);
 assert.equal(after.execution.settledCandidateReference,candidateReference);
 assert.equal(after.execution.settledResultDigest,resultDigest);
 assert.equal(after.execution.settlementRealityBarrierRevision,1);
 assert.equal(after.reservation.status,"consumed");
 assert.equal(after.reservation.settlementExecutionId,executionId);
 assert.equal(after.reservation.settlementResultReference,resultReference);
 assert.equal(after.reservation.settlementCandidateReference,candidateReference);
 assert.equal(after.reservation.settlementResultDigest,resultDigest);
 assert.equal(after.entitlement.reservedUnits,0);
 assert.equal(after.entitlement.consumedUnits,2);
 assert.equal(after.entitlement.remainingUnits,3);
 assert.equal(after.entitlement.entitlementRevision,2);
 const replay=await authority.settleCanonicalResult({executionId});
 assert.equal(replay.settled,true);
 assert.equal(replay.authorized,true);
 assert.equal(replay.idempotent,true);
 assert.deepEqual(await snapshot(),after,"Concurrent settlement plus replay must debit exactly once");
 console.log("GREEN: Mongo command monitoring recorded a second execution update before the first completed under an isolated blocking failpoint; exactly one durable debit and replay idempotency held. HTTP journey remains uncertified.");

}finally{await mongoose.disconnect();}
