import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// Verifier-first: exercise each terminal mutation without any caller-supplied origin or lease fields.
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
 const failures=[];
 for(const [kind,extra] of cases){
  const coordinates={provider:"stripe",providerPaymentReference:"pi-aud-unadorned-"+kind,commercialIntentId:"intent-aud-unadorned-"+kind,principalId:"principal-aud-unadorned-"+kind,amountMinor:1200,currency:"GBP",units:20};
  await value.authority.preserveVerifiedPaidValue({...coordinates,reason:"entitlement-suspended",refundAuthorized:false});
  let rejected=false;
  try{
   await value.authority.terminallySettlePreservedValue({...coordinates,disposition:kind,terminalReference:"evt-aud-unadorned-"+kind,...extra});
  }catch(error){rejected=true;console.log("AUD UNADORNED TERMINAL "+kind+" REJECTED",error?.code||error?.message);}
  const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coordinates.providerPaymentReference});
  const unchanged=row?.status==="preserved-credit"&&row?.remainingAmountMinor===1200&&row?.cumulativeRefundedAmountMinor===0&&row?.chargebackAmountMinor===0&&(!row?.chargebackEvents||row.chargebackEvents.length===0)&&!row?.terminalDisposition;
  console.log("AUD UNADORNED TERMINAL "+kind,JSON.stringify({rejected,unchanged,status:row?.status}));
  if(!unchanged||!rejected)failures.push({kind,rejected,unchanged});
 }
 console.log("AUD UNADORNED TERMINAL FOUR-KIND SUMMARY",JSON.stringify({cases:cases.length,failures}));
 assert.deepEqual(failures,[],"PHYSICAL UNADORNED-DIRECT-TERMINAL RED: one or more unauthorised dispositions changed durable value or did not fail closed");
 console.log("AUD UNADORNED TERMINAL BOUNDARY GREEN: all four kinds fail closed without durable financial effects");
}finally{await mongoose.disconnect();}
