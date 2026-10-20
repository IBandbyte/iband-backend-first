import assert from "node:assert/strict";
import {AsyncLocalStorage} from "node:async_hooks";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// Verifier-only owner-contract candidate. Database CAS remains the authority.
// No production code, scheduling, or financial policy changes.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
let model,original;
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const composition=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(composition.ready,true);
 const authority=composition.authority;
 const coords={provider:"stripe",providerPaymentReference:"pi-owner-candidate",commercialIntentId:"intent-owner-candidate",principalId:"principal-owner-candidate",amountMinor:1200,currency:"GBP",units:20};
 await authority.preserveVerifiedPaidValue({...coords,reason:"entitlement-suspended",refundAuthorized:false});
 model=mongoose.model("MovieMentorCommercialValueDisposition");
 original=model.findOneAndUpdate;
 const context=new AsyncLocalStorage(),winners=new Map();
 model.findOneAndUpdate=function(query,update,...options){
  const q=original.call(this,query,update,...options);
  if(query?.providerPaymentReference!==coords.providerPaymentReference||!update?.$push?.chargebackEvents)return q;
  const lean=q.lean.bind(q);
  q.lean=(...args)=>{
   const l=lean(...args),exec=l.exec.bind(l);
   l.exec=async(...execArgs)=>{
    const result=await exec(...execArgs);
    if(result){const worker=context.getStore()||"unattributed";winners.set(worker,(winners.get(worker)||0)+1);}
    return result;
   };
   return l;
  };
  return q;
 };
 const input={...coords,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-owner-candidate"};
 const [a,b]=await Promise.all(["worker-A","worker-B"].map(worker=>context.run(worker,()=>authority.terminallySettlePreservedValue(input))));
 const replay=await context.run("replay",()=>authority.terminallySettlePreservedValue(input));
 const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coords.providerPaymentReference});
 assert.equal(row.chargebackEvents.length,1,"one durable chargeback event");
 assert.equal(row.chargebackAmountMinor,300);
 assert.equal(row.remainingAmountMinor,900);
 assert.equal([...winners.values()].reduce((n,v)=>n+v,0),1,"one successful conditional write");
 assert.equal(winners.has("unattributed"),false,"write winner attributed to caller");
 assert.equal(winners.has("replay"),false,"replay cannot own prior transition");
 const candidate=["worker-A","worker-B"].map(worker=>({worker,applied:winners.get(worker)===1}));
 assert.equal(candidate.filter(x=>x.applied).length,1,"exactly one owner claim derived from physical CAS");
 assert.equal(a?.applied===true||b?.applied===true,false,"current authority must not be misrepresented as owner-proven");
 assert.equal(replay?.applied===true,false,"replay must not claim application");
 console.log("OWNER-PROOF VERIFIER CANDIDATE GREEN",JSON.stringify({candidate,casWinners:Object.fromEntries(winners),durableEvents:row.chargebackEvents.length,productionAppliedClaims:[a?.applied===true,b?.applied===true],scope:"instrumented verifier observation only; production API unchanged"}));
}finally{
 if(model&&original)model.findOneAndUpdate=original;
 await mongoose.disconnect();
}
