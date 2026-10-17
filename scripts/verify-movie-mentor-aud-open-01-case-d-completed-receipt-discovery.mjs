import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialReversalComposition,isMovieMentorProductionCommercialReversalAuthorityOwnedProof} from "../ai/MovieMentorProductionCommercialReversalComposition.js";

// AUD-OPEN-01 Case D: verifier-only completed-receipt discovery prerequisite.
// A pending-lineage reader is NOT a completed-receipt reader.
// This is an interface/physical-capability court, not an A-B-C recovery or CAS court.
const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri&&(uri.startsWith("mongodb://127.0.0.1:27017/iband_aud_open_01?")||uri==="mongodb://127.0.0.1:27017/iband_aud_open_01"||uri.startsWith("mongodb://localhost:27017/iband_aud_open_01?")||uri==="mongodb://localhost:27017/iband_aud_open_01"),"isolated AUD-OPEN-01 MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"physical MongoDB replica set required");
 const composition=createMovieMentorProductionCommercialReversalComposition();
 assert.equal(composition.ready,true,"production reversal composition required");
 const authority=composition.authority;
 assert.equal(isMovieMentorProductionCommercialReversalAuthorityOwnedProof(authority),true,"owner-proven reversal authority required");
 assert.equal(typeof authority.listCompletedReversalReceipts,"function",
   "AUD-OPEN-01 PHYSICAL RED: production-owned bounded completed-receipt discovery authority is absent");
 const page=await authority.listCompletedReversalReceipts({evidenceSource:"stripe",limit:2,cursor:null});
 assert.ok(page&&Array.isArray(page.receipts),"completed-receipt discovery must return a receipt page");
 assert.ok(page.receipts.length<=2,"page must obey bounded limit");
 assert.ok(page.nextCursor===null||typeof page.nextCursor==="string","cursor must be stable or null");
 for(const receipt of page.receipts){
   assert.equal(receipt.evidenceSource,"stripe");
   assert.ok(receipt.evidenceId&&receipt.providerPaymentReference&&receipt.commercialReference&&receipt.principalId,"completed receipt must preserve commercial provenance");
   assert.equal(receipt.status,"suspended");
 }
 console.log("AUD-OPEN-01 COMPLETED RECEIPT DISCOVERY: bounded owner-proven read capability present");
 console.log("NOT PROVEN: A-B-C unresolved retry, worker activation, concurrent recovery, or financial settlement");
}finally{await mongoose.disconnect();}
