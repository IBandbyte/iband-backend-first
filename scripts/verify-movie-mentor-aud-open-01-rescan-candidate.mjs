import assert from "node:assert/strict";
import mongoose from "mongoose";
// VERIFIER-ONLY discovery candidate. Not a production cursor implementation.
const uri=process.env.MONGO_URI;
assert.ok(uri&&(uri.startsWith("mongodb://127.0.0.1:27017/iband_aud_open_01")||uri.startsWith("mongodb://localhost:27017/iband_aud_open_01")),"isolated MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let session;
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const c=db.collection("aud_open_01_rescan_candidate");
 const row=id=>({_id:id,kind:"charge.dispute.funds_withdrawn",status:"suspended"});
 session=await mongoose.startSession();session.startTransaction();
 await c.insertOne(row("0-earlier-late"),{session});
 await c.insertMany(Array.from({length:51},(_,i)=>row("1-later-"+String(i).padStart(3,"0"))));
 const first=await c.find({_id:{$gt:""},status:"suspended"}).sort({_id:1}).limit(50).toArray();
 assert.equal(first.length,50);
 const highWater=first.at(-1)._id;
 const second=await c.find({_id:{$gt:highWater},status:"suspended"}).sort({_id:1}).toArray();
 assert.equal(second.length,1);
 await session.commitTransaction();
 const forward=await c.find({_id:{$gt:highWater},status:"suspended"}).toArray();
 assert.equal(forward.some(x=>x._id==="0-earlier-late"),false,"forward-only cursor must demonstrably miss late commit");
 // A fresh bounded restart from the beginning, with durable evidence-ID deduplication,
 // is a discovery candidate, not a bounded-time or production scalability guarantee.
 const processed=new Set([...first,...second].map(x=>x._id));
 const rescan=await c.find({status:"suspended"}).sort({_id:1}).toArray();
 const newlyDiscovered=rescan.filter(x=>!processed.has(x._id));
 assert.deepEqual(newlyDiscovered.map(x=>x._id),["0-earlier-late"]);
 assert.equal(new Set([...processed,...newlyDiscovered.map(x=>x._id)]).size,52);
 console.log("AUD RESCAN CANDIDATE GREEN",JSON.stringify({forwardOnlyMissed:true,lateDiscovered:true,uniqueEvidence:52,scope:"isolated bounded dataset; full restart scan candidate only, no production repair or scalable guarantee"}));
}finally{
 if(session){if(session.inTransaction())await session.abortTransaction();await session.endSession();}
 await mongoose.disconnect();
}
