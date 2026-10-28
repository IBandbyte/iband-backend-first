import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated Mongo replica set required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let releaseA;
let reachedA;
const held=new Promise(resolve=>{releaseA=resolve;});
const entered=new Promise(resolve=>{reachedA=resolve;});
let originalCreate;
let model;
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"real replica set required");
 const composition=createMovieMentorProductionCommercialReversalComposition();
 assert.equal(composition.ready,true,"production reversal owner proof required");
 await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
 model=mongoose.model("MovieMentorCommercialReversal");
 originalCreate=model.create;
 model.create=async function(docs,opts){
  if(docs?.[0]?.evidenceId==="evt-prod-order-A"){
   reachedA(docs[0].reversalId);
   await held;
  }
  return originalCreate.call(this,docs,opts);
 };
 const principals=["A","B","C"];
 await db.collection("movie_mentor_inference_entitlement").insertMany(principals.map(p=>({
  domain:"iband.movie-mentor.inference-spend",schema:1,principalId:"prod-order-"+p,
  status:"active",remainingUnits:20,reservedUnits:0,consumedUnits:0,entitlementRevision:1
 })));
 const suspend=p=>composition.authority.suspendVerifiedReversal({reversal:{
  verified:true,evidenceId:"evt-prod-order-"+p,evidenceSource:"stripe",
  evidenceKind:"charge.dispute.funds_withdrawn",providerPaymentReference:"pi-prod-order-"+p,
  reversalAmountMinor:300,currency:"GBP",verifiedAt:new Date().toISOString(),
  commercialReference:"intent-prod-order-"+p,principalId:"prod-order-"+p
 }});
 const a=suspend("A");
 const idA=await entered;
 assert.match(idA,/^[0-9a-f]{24}$/,"A must use production-generated ObjectId");
 const b=await suspend("B");
 const c=await suspend("C");
 assert.ok(idA<b.reversalId&&b.reversalId<c.reversalId,"production ID generation order");
 const first=await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
 assert.equal(first.receipts[0].reversalId,b.reversalId);
 assert.equal(first.nextCursor,b.reversalId);
 releaseA();
 const aResult=await a;
 assert.equal(aResult.reversalId,idA);
 const after=await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1,cursor:first.nextCursor});
 assert.equal(after.receipts.some(r=>r.reversalId===idA),false,"Forward cursor must reproduce the late-commit blind spot");
 const restarted=await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:10,cursor:null});
 assert.equal(restarted.receipts.filter(r=>r.reversalId===idA).length,1,"Fresh cycle through real production authority must discover the late reversal exactly once");
 assert.equal(restarted.receipts.length,3,"Fresh cycle must include all three durable receipts");
 console.log("REAL-AUTHORITY RESCAN CANDIDATE GREEN: fresh cycle discovers late receipt; no financial settlement or scheduler certified");
}finally{
 releaseA?.();
 if(model&&originalCreate)model.create=originalCreate;
 await mongoose.disconnect();
}
