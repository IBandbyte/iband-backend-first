import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// VERIFIER ONLY: demand real-authority owner proof after concurrent CAS.
// Expected genuine RED until production authority provides owner evidence.
// No schema, application or production database changes.
const uri=process.env.MONGO_URI;
assert.ok(uri && (uri.startsWith("mongodb://127.0.0.1:27017/iband_aud_open_01") || uri.startsWith("mongodb://localhost:27017/iband_aud_open_01")), "isolated MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const authority=createMovieMentorProductionCommercialValueDispositionComposition().authority;
 const coordinates={provider:"stripe",providerPaymentReference:"pi-owner-contract-red",commercialIntentId:"intent-owner-contract-red",principalId:"principal-owner-contract-red",amountMinor:1200,currency:"GBP",units:20};
 await authority.preserveVerifiedPaidValue({...coordinates,reason:"entitlement-suspended",refundAuthorized:false});
 const input={...coordinates,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-owner-contract-red"};
 const [a,b]=await Promise.all([authority.terminallySettlePreservedValue(input),authority.terminallySettlePreservedValue(input)]);
 const replay=await authority.terminallySettlePreservedValue(input);
 const row=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider:"stripe",providerPaymentReference:coordinates.providerPaymentReference});
 assert.equal(row.chargebackEvents.length,1,"exactly one durable event");
 assert.equal(row.remainingAmountMinor,900);
 assert.equal(row.chargebackAmountMinor,300);
 const ownerClaims=[a,b].map(x=>x?.applied===true);
 const replayClaim=replay?.applied===true;
 console.log("AUD REAL AUTHORITY OWNER PROOF CONTRACT",JSON.stringify({
  durableEvents:row.chargebackEvents.length,ownerClaims,replayClaim,
  storedOwnerToken:row.chargebackEvents[0].authorityAttemptToken??null,
  scope:"production authority against isolated replica set; verifier-only expected RED"
 }));
 assert.equal(ownerClaims.filter(Boolean).length,1,"PHYSICAL OWNER-PROOF RED: exactly one concurrent caller must have durable winner evidence");
 assert.equal(replayClaim,false,"replay must not claim the original write");
} finally { await mongoose.disconnect(); }
