import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// AUD-OPEN-01 RED-first diagnostic: direct public settlement method must not
// treat caller-authored origin/lease fields as trusted ingress authority.
// This is a deliberately narrow attack court, NOT a full signed-ingress test.
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated audit Mongo required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const composition=createMovieMentorProductionCommercialValueDispositionComposition();
 assert.equal(composition.ready,true);
 const authority=composition.authority;
 const coords={provider:"stripe",providerPaymentReference:"pi-forged-origin",commercialIntentId:"intent-forged-origin",principalId:"principal-forged-origin",amountMinor:1200,currency:"GBP",units:20};
 await authority.preserveVerifiedPaidValue({...coords,reason:"entitlement-suspended",refundAuthorized:false});
 const forged={...coords,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-forged-origin",origin:"verified-provider-ingress",leaseProof:{domain:"stripe-chargeback-reconciliation",owner:"forged-worker-Zorg",generation:999,leaseUntil:new Date("2999-01-01")}};
 let rejected=false;
 try { await authority.terminallySettlePreservedValue(forged); }
 catch(error){rejected=true;console.log("AUD FORGED ORIGIN REJECTION",error?.code||error?.message);}
 const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coords.providerPaymentReference});
 const effects=row?.chargebackEvents?.length||0;
 console.log("AUD FORGED ORIGIN PHYSICAL RESULT",JSON.stringify({rejected,effects,remainingAmountMinor:row?.remainingAmountMinor,scope:"direct real settlement authority, isolated Mongo; NOT a signed ingress integration certification"}));
 assert.equal(effects,0,"caller-supplied ingress label and forged recovery proof must not produce a financial effect");
 assert.equal(rejected,true,"forged origin attempt must fail closed");
}finally{await mongoose.disconnect();}
