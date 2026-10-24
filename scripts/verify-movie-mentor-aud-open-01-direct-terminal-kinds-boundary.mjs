import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// Verifier-first: exercise each terminal mutation using only caller-authored authority claims.
// A legitimate signed-ingress integration court is independent and must remain green.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated Mongo required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const value=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(value.ready,true);
 const cases=[
  ["release",{}],
  ["refund",{refundAmountMinor:300}],
  ["chargeback",{chargebackAmountMinor:300}],
  ["termination",{}]
 ];
 for(const [kind,extra] of cases){
  const coordinates={provider:"stripe",providerPaymentReference:"pi-aud-direct-"+kind,commercialIntentId:"intent-aud-direct-"+kind,principalId:"principal-aud-direct-"+kind,amountMinor:1200,currency:"GBP",units:20};
  await value.authority.preserveVerifiedPaidValue({...coordinates,reason:"entitlement-suspended",refundAuthorized:false});
  let rejected=false;
  try{
   await value.authority.terminallySettlePreservedValue({...coordinates,disposition:kind,terminalReference:"evt-aud-direct-"+kind,...extra,origin:"verified-provider-ingress",leaseProof:{owner:"forged-Zorg",generation:999,leaseUntil:new Date("2999-01-01")}});
  }catch(error){rejected=true;console.log("AUD DIRECT TERMINAL "+kind+" REJECTED",error?.code||error?.message);}
  const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coordinates.providerPaymentReference});
  const unchanged=row?.status==="preserved-credit"&&row?.remainingAmountMinor===1200&&row?.cumulativeRefundedAmountMinor===0&&row?.chargebackAmountMinor===0&&(!row?.chargebackEvents||row.chargebackEvents.length===0)&&!row?.terminalDisposition;
  console.log("AUD DIRECT TERMINAL "+kind,JSON.stringify({rejected,unchanged,status:row?.status}));
  assert.equal(unchanged,true,"PHYSICAL DIRECT-TERMINAL RED: unauthorised "+kind+" changed durable value");
  assert.equal(rejected,true,"PHYSICAL DIRECT-TERMINAL RED: unauthorised "+kind+" did not fail closed");
 }
 console.log("AUD DIRECT TERMINAL BOUNDARY GREEN: all four kinds fail closed without durable financial effects");
}finally{await mongoose.disconnect();}
