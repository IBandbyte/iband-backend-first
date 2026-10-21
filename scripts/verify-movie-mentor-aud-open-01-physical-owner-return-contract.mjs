import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// Physical RED contract: owner proof must be returned by production authority,
// never inferred from a verifier's instrumentation or a later ledger read.
// Isolated Mongo replica set only; no production writes.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const composed=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(composed.ready,true);
 const a=composed.authority;
 const base={provider:"stripe",providerPaymentReference:"pi-contract-owner",commercialIntentId:"intent-contract-owner",principalId:"principal-contract-owner",amountMinor:1200,currency:"GBP",units:20};
 await a.preserveVerifiedPaidValue({...base,reason:"entitlement-suspended",refundAuthorized:false});
 const chargeback={...base,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-contract-owner"};
 const results=await Promise.all([a.terminallySettlePreservedValue(chargeback),a.terminallySettlePreservedValue(chargeback)]);
 const replay=await a.terminallySettlePreservedValue(chargeback);
 const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:base.providerPaymentReference});
 assert.equal(row.chargebackEvents.length,1,"single durable event");
 assert.equal(row.chargebackAmountMinor,300);
 assert.equal(row.remainingAmountMinor,900);
 assert.equal(results.filter(x=>x?.applied===true).length,1,"exactly one concurrent caller must receive production-owned applied proof");
 assert.equal(results.filter(x=>x?.applied===false).length,1,"loser must explicitly be a nonowner");
 assert.equal(replay?.applied,false,"replay cannot claim ownership");
 const refundBase={...base,providerPaymentReference:"pi-contract-refund",commercialIntentId:"intent-contract-refund"};
 await a.preserveVerifiedPaidValue({...refundBase,reason:"entitlement-suspended",refundAuthorized:false});
 const refund={...refundBase,disposition:"refund",refundAmountMinor:250,terminalReference:"refund-contract-1"};
 const first=await a.terminallySettlePreservedValue(refund);
 const repeat=await a.terminallySettlePreservedValue(refund);
 assert.equal(first?.applied,true,"first cumulative refund transition owns its write");
 assert.equal(repeat?.applied,false,"refund replay is not a write owner");
 const progressed=await a.terminallySettlePreservedValue({...refund,refundAmountMinor:400,terminalReference:"refund-contract-2"});
 assert.equal(progressed?.applied,true,"new cumulative refund progression owns its write");
 assert.equal(progressed?.remainingAmountMinor,800,"refund progression conserves value");
 const absent=await a.terminallySettlePreservedValue({...base,providerPaymentReference:"pi-contract-absent",commercialIntentId:"intent-contract-absent",disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-contract-absent"});
 assert.equal(absent?.status,"not-preserved");
 assert.equal(absent?.applied,false,"absent row cannot confer ownership");
 console.log("AUD-OPEN-01 PHYSICAL OWNER RETURN CONTRACT GREEN: concurrent chargeback, replay, refund progression and absent-row ownership proven");
}finally{await mongoose.disconnect();}
