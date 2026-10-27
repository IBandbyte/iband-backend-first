import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
import {createMovieMentorProductionCommercialReversalComposition} from "../ai/MovieMentorProductionCommercialReversalComposition.js";

// VERIFIER ONLY: actual production authority, isolated MongoDB.
// Proves whether durable settlement survives a server writeConcernError.
// Does NOT prove real post-commit network disconnection or caller ownership.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,retryWrites:false});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const authority=createMovieMentorProductionCommercialValueDispositionComposition().authority;
 const coordinates={provider:"stripe",providerPaymentReference:"pi-real-wc",commercialIntentId:"intent-real-wc",principalId:"principal-real-wc",amountMinor:1200,currency:"GBP",units:20};
 await authority.preserveVerifiedPaidValue({...coordinates,reason:"entitlement-suspended",refundAuthorized:false});
 // Establish independently committed provider reversal evidence before the fault.
 // Otherwise the production evidence gate rejects settlement before findAndModify.
 const reversal=createMovieMentorProductionCommercialReversalComposition();
 assert.equal(reversal.ready,true,"original production reversal authority required");
 const suspended=await reversal.authority.suspendVerifiedReversal({reversal:{verified:true,evidenceId:"evt-real-wc",evidenceSource:"stripe",evidenceKind:"charge.dispute.funds_withdrawn",providerPaymentReference:coordinates.providerPaymentReference,reversalAmountMinor:300,currency:coordinates.currency,verifiedAt:new Date().toISOString(),commercialReference:coordinates.commercialIntentId,principalId:coordinates.principalId}});
 assert.ok(suspended,"reversal suspension must complete before fault injection");
 const committedReceipt=await db.collection("movie_mentor_commercial_reversal").findOne({domain:"iband.movie-mentor.inference-spend",schema:1,evidenceSource:"stripe",evidenceId:"evt-real-wc",providerPaymentReference:coordinates.providerPaymentReference,commercialReference:coordinates.commercialIntentId,principalId:coordinates.principalId,status:"suspended",evidenceKind:"charge.dispute.funds_withdrawn",reversalAmountMinor:300});
 assert.ok(committedReceipt,"independent committed reversal evidence must be visible before financial fault injection");
 const input={...coordinates,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-real-wc"};
 let caller="UNKNOWN",error=null;
 try{
  await db.admin().command({configureFailPoint:"failCommand",mode:{times:1},data:{
   failCommands:["findAndModify"],writeConcernError:{code:91,codeName:"ShutdownInProgress",errmsg:"AUD production authority injected write concern uncertainty"}
  }});
  try{
   const result=await authority.terminallySettlePreservedValue(input);
   caller=result?"RETURNED_RESULT":"RETURNED_EMPTY";
  }catch(e){error={name:e.name,code:e.code??null,message:e.message};}
 }finally{await db.admin().command({configureFailPoint:"failCommand",mode:"off"});}
 const collection=db.collection("movie_mentor_commercial_value_disposition");
 const before=await collection.findOne({provider:"stripe",providerPaymentReference:"pi-real-wc"});
 const events=before.chargebackEvents.filter(e=>e.reference==="evt-real-wc");
 assert.equal(events.length,1,"real authority must durably settle despite injected write concern error");
 assert.equal(before.remainingAmountMinor,900);
 assert.equal(before.chargebackAmountMinor,300);
 const observed=await authority.observePreservedValueSettlement({...coordinates,evidenceId:"evt-real-wc",chargebackAmountMinor:300});
 assert.equal(observed.settlementState,"settled");
 const replay=await authority.terminallySettlePreservedValue(input);
 const after=await collection.findOne({provider:"stripe",providerPaymentReference:"pi-real-wc"});
 assert.equal(after.chargebackEvents.length,1,"replay must not duplicate financial event");
 assert.equal(after.remainingAmountMinor,900);
 assert.equal(after.chargebackAmountMinor,300);
 const ownerTokenPresent=Object.hasOwn(events[0],"authorityAttemptToken");
 const replayProvesOwnership=replay?.applied===true;
 console.log("AUD REAL AUTHORITY WRITE CONCERN DIAGNOSTIC",JSON.stringify({
  caller,error,durableEvents:events.length,observation:observed.settlementState,
  replayEvents:after.chargebackEvents.length,ownerTokenPresent,replayProvesOwnership,
  scope:"actual production authority against isolated replica set; server writeConcernError only; no real post-commit network loss"
 }));
 assert.ok(error&&error.name==="MongoWriteConcernError","write concern uncertainty must physically reach production authority");
 assert.equal(ownerTokenPresent,false,"current production event must not be mistaken for ownership-bearing candidate");
 assert.equal(replayProvesOwnership,false,"replay after uncertain write must not claim original ownership");
}finally{await mongoose.disconnect();}
