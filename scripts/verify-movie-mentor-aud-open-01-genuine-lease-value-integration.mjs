import assert from "node:assert/strict";
import mongoose from "mongoose";
import {acquireRecoveryOwner,releaseRecoveryOwner,MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION} from "../ai/MovieMentorCompletedChargebackRecoveryOwnerInternal.js";
import {createMovieMentorProductionCommercialValueDispositionComposition,settleMovieMentorRecoveryWithOwner} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// Isolated physical court: genuine recovery lease + genuine commercial value composition.
// The existing RED-first integration verifier is deliberately left unchanged.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let restore=null;
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(value.ready,true);
 const leases=db.collection(MOVIE_MENTOR_RECOVERY_LEASE_COLLECTION);
 const ledger=db.collection("movie_mentor_commercial_value_disposition");
 const coordinates=p=>({provider:"stripe",providerPaymentReference:"pi-real-lease-"+p,commercialIntentId:"intent-real-lease-"+p,principalId:"principal-real-lease-"+p,amountMinor:1200,currency:"GBP",units:20,disposition:"chargeback",terminalReference:"evt-real-lease-"+p,chargebackAmountMinor:300});
 for(const p of ["before","inflight"]){
  const c=coordinates(p);
  await value.authority.preserveVerifiedPaidValue({...c,reason:"entitlement-suspended",refundAuthorized:false});
  await db.collection("movie_mentor_commercial_reversal").insertOne({domain:"iband.movie-mentor.inference-spend",schema:1,evidenceSource:"stripe",evidenceId:c.terminalReference,evidenceKind:"charge.dispute.funds_withdrawn",providerPaymentReference:c.providerPaymentReference,commercialReference:c.commercialIntentId,principalId:c.principalId,status:"suspended",reversalAmountMinor:300,currency:"GBP"});
 }
 const settle=(capability,p)=>settleMovieMentorRecoveryWithOwner({authority:value.authority,capability,input:coordinates(p)});
 const row=p=>ledger.findOne({provider:"stripe",providerPaymentReference:coordinates(p).providerPaymentReference});
 const a=await acquireRecoveryOwner({owner:"physical-A",leaseMs:30000});
 assert.equal((await leases.findOne({_id:"completed-chargeback:stripe"})).generation,1);
 assert.equal(await releaseRecoveryOwner({capability:a}),true);
 const b=await acquireRecoveryOwner({owner:"physical-B",leaseMs:30000});
 assert.equal(b.generation,2);
 await assert.rejects(settle(a,"before"),e=>e.code==="MOVIE_MENTOR_COMPLETED_REVERSAL_RECOVERY_FENCED","A must be fenced after B's durable takeover");
 assert.equal((await row("before")).chargebackAmountMinor,0);
 const applied=await settle(b,"before");
 assert.equal(applied.applied,true);
 assert.equal((await settle(b,"before")).applied,false,"same owner replay is idempotent");
 assert.equal((await row("before")).chargebackEvents.length,1);
 assert.equal(await releaseRecoveryOwner({capability:b}),true);
 const c=await acquireRecoveryOwner({owner:"physical-C",leaseMs:30000});
 assert.equal(c.generation,3);
 // Hold the actual composition's financial writer after the real lease has
 // been written in the same transaction. Competing takeover must not commit
 // while this transaction is active.
 const model=mongoose.model("MovieMentorCommercialValueDisposition");
 const original=model.findOneAndUpdate;
 let entered,release;
 const reached=new Promise(r=>entered=r),held=new Promise(r=>release=r);
 let intercepted=false;
 model.findOneAndUpdate=function(query,update,...args){
  const q=original.call(this,query,update,...args);
  if(!intercepted&&query?.providerPaymentReference==="pi-real-lease-inflight"&&update?.$push?.chargebackEvents){
   intercepted=true;
   const originalLean=q.lean.bind(q);
   q.lean=(...params)=>{
    const lean=originalLean(...params),exec=lean.exec.bind(lean);
    lean.exec=(...execArgs)=>{entered();return held.then(()=>exec(...execArgs));};
    return lean;
   };
  }
  return q;
 };
 restore=()=>{model.findOneAndUpdate=original;release?.();};
 const inflight=settle(c,"inflight");
 await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(Error("real financial writer not reached")),10000))]);
 const observedLease=await leases.findOne({_id:"completed-chargeback:stripe"});
 assert.equal(observedLease.owner,"physical-C");
 assert.equal(observedLease.generation,3);
 // The lease-document write is held by C's active transaction. A competing
 // update with a bounded server-side deadline cannot claim a committed takeover.
 let takeoverCommitted=false;
 try{
  const takeover=await leases.updateOne({_id:"completed-chargeback:stripe",owner:"physical-C",generation:3},{$set:{owner:"physical-D"},$inc:{generation:1}},{maxTimeMS:750});
  takeoverCommitted=takeover.modifiedCount===1;
 }catch(error){
  assert.ok(error?.code===50||/timeout|conflict|lock/i.test(error.message),"unexpected takeover error: "+error.message);
 }
 assert.equal(takeoverCommitted,false,"takeover must not commit ahead of C's in-flight financial transaction");
 release();
 const result=await inflight;
 assert.equal(result.applied,true);
 restore();restore=null;
 const committed=await row("inflight");
 assert.equal(committed.remainingAmountMinor,900);
 assert.equal(committed.chargebackAmountMinor,300);
 assert.equal(committed.chargebackEvents.length,1);
 assert.equal(await releaseRecoveryOwner({capability:c}),true);
 const d=await acquireRecoveryOwner({owner:"physical-D",leaseMs:30000});
 assert.equal(d.generation,4);
 assert.equal((await settle(d,"inflight")).applied,false,"successor cannot duplicate committed settlement");
 assert.equal((await row("inflight")).chargebackEvents.length,1);
 console.log("AUD GENUINE LEASE+VALUE COMPOSITION GREEN: pre-transaction stale owner fenced; in-flight competing takeover blocked; financial settlement atomic and successor replay exactly once.");
}finally{restore?.();await mongoose.disconnect();}
