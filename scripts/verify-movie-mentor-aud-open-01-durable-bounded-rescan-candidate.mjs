import assert from "node:assert/strict";
import mongoose from "mongoose";
// Isolated verifier-only candidate: durable checkpoint + dedup across worker restart.
// Not production authority, not a scheduler, and not a proof of eventual recovery.
const uri=process.env.MONGO_URI;
assert.ok(uri&&(uri.startsWith("mongodb://127.0.0.1:27017/iband_aud_open_01")||uri.startsWith("mongodb://localhost:27017/iband_aud_open_01")),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let session;
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName);
 const receipts=db.collection("aud_durable_rescan_receipts");
 const dedup=db.collection("aud_durable_rescan_dedup");
 const checkpoint=db.collection("aud_durable_rescan_checkpoint");
 await Promise.all([db.createCollection(receipts.collectionName),db.createCollection(dedup.collectionName),db.createCollection(checkpoint.collectionName)]);
 await dedup.createIndex({evidenceId:1},{unique:true});
 const row=id=>({_id:id,evidenceId:id,status:"suspended"});
 session=await mongoose.startSession();session.startTransaction();
 await receipts.insertOne(row("0-late"),{session});
 await receipts.insertMany(Array.from({length:51},(_,i)=>row("1-later-"+String(i).padStart(3,"0"))));
 const pageLimit=10;
 async function pass(label,maxPages){
  let pages=0,newEvidence=0;
  while(pages<maxPages){
   const state=await checkpoint.findOne({_id:"rescan"});
   const filter={status:"suspended",...(state?.cursor?{_id:{$gt:state.cursor}}:{})};
   const page=await receipts.find(filter).sort({_id:1}).limit(pageLimit).toArray();
   if(!page.length){
    await checkpoint.updateOne({_id:"rescan"},{$set:{cursor:null,cycle:(state?.cycle||0)+1}},{upsert:true});
    return {label,pages,newEvidence,complete:true};
   }
   for(const item of page){
    const result=await dedup.updateOne({evidenceId:item.evidenceId},{$setOnInsert:{evidenceId:item.evidenceId,firstPass:label}},{upsert:true});
    if(result.upsertedCount===1)newEvidence++;
   }
   await checkpoint.updateOne({_id:"rescan"},{$set:{cursor:page.at(-1)._id}},{upsert:true});
   pages++;
  }
  return {label,pages,newEvidence,complete:false};
 }
 const first=await pass("before-restart",3);
 assert.equal(first.pages,3);assert.equal(first.newEvidence,30);
 assert.equal(await dedup.countDocuments({}),30);
 // Reinstantiate the worker by reloading only MongoDB state, not any in-memory Set.
 const second=await pass("after-restart",3);
 assert.equal(second.complete,false);assert.equal(second.newEvidence,21);
 assert.equal(await dedup.countDocuments({}),51);
 await session.commitTransaction();
 const boundary=await pass("complete-first-cycle",1);
 assert.equal(boundary.complete,true);assert.equal(boundary.newEvidence,0);
 const third=await pass("new-cycle",7);
 assert.equal(third.complete,true);assert.equal(third.newEvidence,1);
 assert.equal(await dedup.countDocuments({}),52);
 assert.ok(await dedup.findOne({evidenceId:"0-late"}));
 const fourth=await pass("replay",7);
 assert.equal(fourth.newEvidence,0);
 assert.equal(await dedup.countDocuments({}),52);
 assert.ok([first,second,third,fourth].every(x=>x.pages<=7));
 console.log("AUD DURABLE BOUNDED RESCAN CANDIDATE GREEN",JSON.stringify({first,second,boundary,third,fourth,durableUniqueEvidence:52,pageLimit,scope:"isolated MongoDB candidate; persisted cursor and dedup, bounded per pass; no autonomous trigger, production settlement, multi-worker lease or scalable guarantee"}));
}finally{
 if(session){if(session.inTransaction())await session.abortTransaction();await session.endSession();}
 await mongoose.disconnect();
}
