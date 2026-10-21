import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let M,original;
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const composition=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(composition.ready,true);
 const authority=composition.authority;
 const coordinates={provider:"stripe",providerPaymentReference:"pi-compatibility",commercialIntentId:"intent-compatibility",principalId:"principal-compatibility",amountMinor:1200,currency:"GBP",units:20};
 await authority.preserveVerifiedPaidValue({...coordinates,reason:"entitlement-suspended",refundAuthorized:false});
 M=mongoose.model("MovieMentorCommercialValueDisposition");
 original=M.findOneAndUpdate;
 let winners=0;
 M.findOneAndUpdate=function(query,update,...options){
  const q=original.call(this,query,update,...options);
  if(update?.$push?.chargebackEvents){
   const lean=q.lean.bind(q);
   q.lean=(...args)=>{
    const l=lean(...args),exec=l.exec.bind(l);
    l.exec=async(...rest)=>{const result=await exec(...rest);if(result)winners++;return result;};
    return l;
   };
  }
  return q;
 };
 const input={...coordinates,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-compatibility"};
 // Both calls exercise the real production authority, with no proposed API injected.
 const [first,second]=await Promise.all([authority.terminallySettlePreservedValue(input),authority.terminallySettlePreservedValue(input)]);
 const replay=await authority.terminallySettlePreservedValue(input);
 const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:"pi-compatibility"});
 assert.equal(winners,1,"exactly one physical chargeback update");
 assert.equal(row.chargebackEvents.length,1);
 assert.equal(row.remainingAmountMinor,900);
 assert.equal(row.chargebackAmountMinor,300);
 assert.equal([first,second].filter(result=>result.applied===true).length,1,"exactly one concurrent caller must receive owner proof");
 assert.equal(replay.applied,false,"later replay cannot claim ownership");
 for(const result of [first,second,replay]){
  assert.equal(result.remainingAmountMinor,900);
  assert.equal(result.chargebackAmountMinor,300);
  assert.equal(typeof result.applied,"boolean","owner-return contract must be explicit");
  assert.equal(Object.hasOwn(result,"attemptToken"),false);
 }
 assert.equal(row.chargebackEvents[0].authorityAttemptToken,undefined,"no ownership token in current production schema");
 console.log("AUD REAL AUTHORITY COMPATIBILITY AMBIGUITY GREEN",JSON.stringify({durableCasWinners:winners,publicResultsIndistinguishable:false,ownerReturnContract:true,ownerProofAvailable:true,scope:"real production authority in isolated MongoDB; diagnostic of current ambiguity, not a repair or future API certification"}));
}finally{if(M&&original)M.findOneAndUpdate=original;await mongoose.disconnect();}
