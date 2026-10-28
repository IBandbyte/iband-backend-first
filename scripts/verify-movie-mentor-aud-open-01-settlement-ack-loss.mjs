import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated AUD-OPEN-01 MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let model,originalUpdate;
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const composition=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(composition.ready,true);
 const authority=composition.authority;
 const coordinates={provider:"stripe",providerPaymentReference:"pi-aud-settlement-ack-loss",commercialIntentId:"aud-settlement-ack-loss-intent",principalId:"aud-settlement-ack-loss-principal",amountMinor:1200,currency:"GBP",units:20};
 const eventReference="evt-aud-settlement-ack-loss";
 await authority.preserveVerifiedPaidValue({...coordinates,reason:"entitlement-suspended",refundAuthorized:false});
 model=mongoose.model("MovieMentorCommercialValueDisposition");
 originalUpdate=model.findOneAndUpdate;
 let injected=0,committedWrites=0;
 model.findOneAndUpdate=function(query,update,...options){
  const q=originalUpdate.call(this,query,update,...options);
  if(query?.providerPaymentReference!==coordinates.providerPaymentReference||!update?.$push?.chargebackEvents)return q;
  const lean=q.lean.bind(q);
  q.lean=(...args)=>{
   const result=lean(...args),exec=result.exec.bind(result);
   result.exec=async(...execArgs)=>{
    const updated=await exec(...execArgs);
    if(updated){
     committedWrites++;
     if(injected++===0)throw Error("AUD_SYNTHETIC_SETTLEMENT_POST_WRITE_ACK_LOSS");
    }
    return updated;
   };
   return result;
  };
  return q;
 };
 const settle=()=>authority.terminallySettlePreservedValue({...coordinates,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:eventReference});
 await assert.rejects(settle,e=>e?.message==="AUD_SYNTHETIC_SETTLEMENT_POST_WRITE_ACK_LOSS");
 assert.equal(injected,1,"synthetic loss must occur after successful chargeback CAS");
 let row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coordinates.providerPaymentReference});
 assert.equal(row.chargebackAmountMinor,300,"durable chargeback must survive lost caller acknowledgement");
 assert.equal(row.remainingAmountMinor,900,"remaining preserved value must be reduced once");
 assert.equal(row.chargebackEvents.filter(e=>e.reference===eventReference).length,1,"exactly one durable event after lost acknowledgement");
 const replay=await settle();
 assert.equal(replay.chargebackAmountMinor,300,"same reference must be idempotent");
 row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coordinates.providerPaymentReference});
 assert.equal(row.chargebackAmountMinor,300);
 assert.equal(row.remainingAmountMinor,900);
 assert.equal(row.chargebackEvents.filter(e=>e.reference===eventReference).length,1);
 assert.equal(committedWrites,1,"replay must not write a second chargeback event");
 console.log("AUD SETTLEMENT-LEVEL SYNTHETIC ACK LOSS GREEN",JSON.stringify({injected,committedWrites,chargebackAmountMinor:row.chargebackAmountMinor,remainingAmountMinor:row.remainingAmountMinor,events:row.chargebackEvents.length,scope:"synthetic post-write application exception, NOT real MongoDB network acknowledgement loss",ownership:"caller of lost acknowledgement cannot prove writer identity from normalized replay return"}));
}finally{
 if(model&&originalUpdate)model.findOneAndUpdate=originalUpdate;
 await mongoose.disconnect();
}
