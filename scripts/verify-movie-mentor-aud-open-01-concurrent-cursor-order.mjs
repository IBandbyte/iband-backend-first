import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated Mongo replica set required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let session=null;
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"real replica set required");
 const composition=createMovieMentorProductionCommercialReversalComposition();
 assert.equal(composition.ready,true,"owner-proven production reversal required");
 await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:1});
 const model=mongoose.model("MovieMentorCommercialReversal");
 const collection=db.collection("movie_mentor_commercial_reversal");
 const receipt=(id,kind="charge.refunded")=>({
  domain:"iband.movie-mentor.inference-spend",schema:1,reversalId:id,evidenceId:"evt-cursor-"+id,
  evidenceSource:"stripe",evidenceKind:kind,providerPaymentReference:"pi-cursor-"+id,
  commercialReference:"intent-cursor-"+id,principalId:"principal-cursor-"+id,
  reversalAmountMinor:300,currency:"GBP",entitlementRevisionBefore:1,
  entitlementRevisionAfter:2,status:"suspended",reversedAt:new Date()
 });
 // The earlier key is inserted in a real Mongo transaction but deliberately not committed.
 // A later key is committed and the real production cursor scanner advances past it.
 session=await mongoose.startSession();
 session.startTransaction();
 await collection.insertOne(receipt("0-a-late-commit","charge.dispute.funds_withdrawn"),{session});
 await collection.insertMany(Array.from({length:51},(_,i)=>receipt("1-b-committed-"+String(i).padStart(3,"0"))));
 const first=await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:50});
 assert.equal(first.receipts.length,50);
 assert.ok(first.nextCursor,"first page must advance");
 assert.ok(first.nextCursor>"0-a-late-commit");
 const second=await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:50,cursor:first.nextCursor});
 assert.equal(second.receipts.length,1);
 assert.equal(second.nextCursor,null);
 // The real earlier transaction commits only after the scanner has passed its key.
 await session.commitTransaction();
 const committed=await collection.findOne({reversalId:"0-a-late-commit"});
 assert.ok(committed,"earlier chargeback is now durably committed");
 const afterCursor=await composition.authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:50,cursor:first.nextCursor});
 assert.equal(afterCursor.receipts.some(r=>r.reversalId==="0-a-late-commit"),true,
  "PHYSICAL CURSOR RED: committed earlier-ID chargeback is invisible after scanner advanced");
 console.log("CONCURRENT CURSOR GREEN: late-committed earlier-ID receipt remains discoverable");
}finally{
 if(session){if(session.inTransaction())await session.abortTransaction();await session.endSession();}
 await mongoose.disconnect();
}
