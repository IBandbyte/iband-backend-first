import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition,isMovieMentorProductionCommercialValueDispositionAuthorityOwnedProof} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// AUD-OPEN-01 Case D: verifier FIRST. Observation is not settlement.
// This court intentionally cannot be satisfied by calling the financial writer.
const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated AUD-OPEN-01 MongoDB required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try {
  const db=mongoose.connection.db;
  assert.ok((await db.admin().command({hello:1})).setName,"physical MongoDB replica set required");
  const composition=createMovieMentorProductionCommercialValueDispositionComposition();
  assert.equal(composition.ready,true,"production disposition authority must compose");
  const authority=composition.authority;
  assert.equal(isMovieMentorProductionCommercialValueDispositionAuthorityOwnedProof(authority),true,"owned disposition proof required");

  const provider="stripe", providerPaymentReference="pi_aud_observe_01";
  const commercialIntentId="intent_aud_observe_01",principalId="principal_aud_observe_01";
  const evidenceId="evt_aud_observe_01";
  await authority.preserveVerifiedPaidValue({provider,providerPaymentReference,commercialIntentId,principalId,amountMinor:1200,currency:"GBP",units:20,reason:"entitlement-suspended",refundAuthorized:false});

  // The production authority must supply an observation-only, owner-proven read.
  // No direct DB inspection is permitted to masquerade as the production API.
  assert.equal(typeof authority.observePreservedValueSettlement,"function",
    "AUD-OPEN-01 PHYSICAL RED: production-owned read-only settlement observation authority is absent");

  const coordinates={provider,providerPaymentReference,commercialIntentId,principalId,evidenceId,chargebackAmountMinor:300,currency:"GBP"};
  const before=await authority.observePreservedValueSettlement(coordinates);
  assert.equal(before?.settlementState,"unsettled","preserved credit without an evidence event is unsettled");
  const rowBefore=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider,providerPaymentReference});
  assert.equal(rowBefore.remainingAmountMinor,1200);
  assert.equal(rowBefore.chargebackAmountMinor,0);

  await authority.terminallySettlePreservedValue({provider,providerPaymentReference,commercialIntentId,principalId,amountMinor:1200,currency:"GBP",units:20,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:evidenceId});
  const after=await authority.observePreservedValueSettlement(coordinates);
  assert.equal(after?.settlementState,"settled","physical evidence-linked settlement must be observed");
  const rowAfter=await db.collection("movie_mentor_commercial_value_disposition").findOne({provider,providerPaymentReference});
  assert.equal(rowAfter.remainingAmountMinor,900);
  assert.equal(rowAfter.chargebackAmountMinor,300);
  assert.equal(rowAfter.chargebackEvents.filter(x=>x.reference===evidenceId).length,1);

  const missing=await authority.observePreservedValueSettlement({...coordinates,providerPaymentReference:"pi_aud_observe_missing"});
  assert.equal(missing?.settlementState,"missing","missing row must not count as settlement");
  console.log("AUD-OPEN-01 CASE D OBSERVATION: owner-proven read distinguishes unsettled, settled and missing; financial writer remains sole mutator");
} finally {await mongoose.disconnect();}
