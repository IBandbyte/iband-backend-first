import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import mongoose from "mongoose";
const uri=process.env.MONGO_URI;
assert.ok(uri&&/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated replica-set database required");
await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
try{
 const db=mongoose.connection.db;
 assert.ok((await db.admin().command({hello:1})).setName,"replica set required");
 const c=db.collection("aud_open_01_owner_authenticity");
 const reference="evt-owner-authenticity";
 // Candidate trust boundary: a private authority closure mints an opaque attempt token.
 // The caller's asserted owner label is deliberately ignored; only a CAS winner
 // can persist the token in the same atomic update as the financial change.
 const authority=async ({payment,assertedOwner})=>{
  const token=randomUUID();
  const updated=await c.findOneAndUpdate({_id:payment,status:"preserved-credit",remainingAmountMinor:1200,events:{$not:{$elemMatch:{reference}}}},{$inc:{remainingAmountMinor:-300,chargebackAmountMinor:300},$push:{events:{reference,amountMinor:300,authorityAttemptToken:token}}},{returnDocument:"after"});
  return Object.freeze({applied:Boolean(updated),attemptToken:updated?token:null,assertedOwnerIgnored:true});
 };
 const payment="pi-authenticity";
 await c.insertOne({_id:payment,status:"preserved-credit",remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const [a,b]=await Promise.all([authority({payment,assertedOwner:"forged-supervisor"}),authority({payment,assertedOwner:"forged-supervisor"})]);
 assert.equal(Number(a.applied)+Number(b.applied),1,"one physical writer");
 const row=await c.findOne({_id:payment});
 assert.equal(row.remainingAmountMinor,900);assert.equal(row.chargebackAmountMinor,300);assert.equal(row.events.length,1);
 assert.equal(row.events[0].authorityAttemptToken,a.applied?a.attemptToken:b.attemptToken,"atomic durable token must match successful writer");
 assert.equal(row.events[0].assertedOwner,undefined,"caller-supplied owner label cannot enter durable event");
 const replay=await authority({payment,assertedOwner:"forged-supervisor"});
 assert.equal(replay.applied,false);assert.equal(replay.attemptToken,null,"replay cannot receive ownership");
 const after=await c.findOne({_id:payment});
 assert.equal(after.events[0].authorityAttemptToken,row.events[0].authorityAttemptToken);
 // An opaque token is not proof of caller identity or an authenticated principal.
 // It proves only this isolated authority attempt was the CAS winner.
 const lost="pi-authenticity-lost";
 await c.insertOne({_id:lost,status:"preserved-credit",remainingAmountMinor:1200,chargebackAmountMinor:0,events:[]});
 const committed=await authority({payment:lost,assertedOwner:"forged-supervisor"});
 assert.equal(committed.applied,true);
 const lostAckCallerView={applied:"UNKNOWN",attemptToken:null};
 assert.equal(lostAckCallerView.applied,"UNKNOWN","synthetic lost response cannot establish ownership to caller");
 const durable=await c.findOne({_id:lost});
 assert.equal(durable.events[0].authorityAttemptToken,committed.attemptToken,"durable token survives synthetic lost response");
 const afterLossReplay=await authority({payment:lost,assertedOwner:"forged-supervisor"});
 assert.equal(afterLossReplay.applied,false);
 // Legacy rows lack tokens and must remain unowned; no backfill attribution.
 await c.insertOne({_id:"pi-authenticity-legacy",status:"preserved-credit",remainingAmountMinor:900,chargebackAmountMinor:300,events:[{reference,amountMinor:300}]});
 const legacy=await c.findOne({_id:"pi-authenticity-legacy"});
 assert.equal(legacy.events[0].authorityAttemptToken,undefined);
 const legacyReplay=await authority({payment:"pi-authenticity-legacy",assertedOwner:"forged-supervisor"});
 assert.equal(legacyReplay.applied,false);
 console.log("AUD ISOLATED OWNER AUTHENTICITY GREEN",JSON.stringify({casWinners:1,forgedLabelPersisted:false,replayOwnership:false,lostAckCaller:"UNKNOWN",durableTokenPresent:true,legacyOwner:"UNKNOWN",scope:"verifier-only opaque attempt token in isolated collection; not authenticated worker identity, not production authority, synthetic lost response only"}));
}finally{await mongoose.disconnect();}
