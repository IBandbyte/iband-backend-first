import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createMovieMentorProductionCommercialValueDispositionComposition} from "../ai/MovieMentorProductionCommercialValueDispositionComposition.js";

// AUD-OPEN-01: physical preserved-credit ledger court. Never connects to production.
const uri=process.env.MONGO_URI;
assert.ok(uri && /(?:127\.0\.0\.1|localhost):27017\/iband_aud_open_01(?:\?|$)/.test(uri),"isolated local test MongoDB URI required");
// Diagnostic watchdog is a HARNESS timeout, never an accounting RED.
const HARD_TIMEOUT_MS=120000;
const hardWatchdog=setTimeout(()=>{
  console.error("HARNESS_TIMEOUT: exceeded "+HARD_TIMEOUT_MS+"ms; no accounting verdict");
  process.exit(2);
},HARD_TIMEOUT_MS);
function checkpoint(label){console.log("AUD-OPEN-01 CHECKPOINT "+label);}
async function bounded(label,operation){
  checkpoint("START "+label);
  let timer;
  try {
    const result=await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_,reject)=>{timer=setTimeout(()=>{
        const e=new Error("HARNESS_TIMEOUT "+label+" after 20000ms; no accounting verdict");
        e.code="AUD_OPEN_01_HARNESS_TIMEOUT";
        reject(e);
      },20000);})
    ]);
    checkpoint("DONE "+label);
    return result;
  } finally {clearTimeout(timer);}
}
checkpoint("BOOTSTRAP");
const composition=createMovieMentorProductionCommercialValueDispositionComposition();
assert.equal(composition.ready,true);
const authority=composition.authority;
const collection=()=>mongoose.connection.collection("movie_mentor_commercial_value_disposition");
const base={provider:"stripe",commercialIntentId:"aud-open-01-intent",principalId:"aud-open-01-principal",amountMinor:1200,currency:"GBP",units:20,disposition:"chargeback",chargebackAmountMinor:300,terminalReference:"evt-aud-open-01-chargeback"};
async function seed(payment){
  const args={...base,providerPaymentReference:payment};
  await bounded(payment+" preserve",()=>authority.preserveVerifiedPaidValue({...args,reason:"entitlement-suspended",refundAuthorized:false}));
  await bounded(payment+" refund",()=>authority.terminallySettlePreservedValue({...args,disposition:"refund",refundAmountMinor:500,terminalReference:"evt-aud-open-01-refund"}));
  return args;
}
async function check(payment,label){
  const row=await bounded(label+" physical read",()=>collection().findOne({provider:"stripe",providerPaymentReference:payment}));
  assert.ok(row,label+": row must exist");
  assert.equal(row.cumulativeRefundedAmountMinor,500,label+": cumulative refund");
  assert.equal(row.chargebackAmountMinor,300,label+": chargeback must apply exactly once");
  assert.equal(row.remainingAmountMinor,400,label+": customer credit must survive");
  assert.equal(row.status,"preserved-credit",label+": surviving value must remain reachable");
  assert.equal(row.cumulativeRefundedAmountMinor+row.chargebackAmountMinor+row.remainingAmountMinor,1200,label+": conservation");
}
try {
  // A: first partial chargeback.
  const a=await seed("pi-aud-open-01-a");
  await bounded("A first chargeback",()=>authority.terminallySettlePreservedValue(a));
  await check(a.providerPaymentReference,"A first event");
  console.log("PASS A: first partial chargeback");

  // B: same payment and identical evidence reference delivered twice.
  const b=await seed("pi-aud-open-01-b");
  await bounded("B first chargeback",()=>authority.terminallySettlePreservedValue(b));
  await bounded("B identical replay",()=>authority.terminallySettlePreservedValue(b));
  await check(b.providerPaymentReference,"B duplicate event");
  console.log("PASS B: identical event replay");

  // C: concurrent delivery of identical evidence to production accounting owner.
  const c=await seed("pi-aud-open-01-c");
  await bounded("C concurrent duplicate",()=>Promise.all([authority.terminallySettlePreservedValue(c),authority.terminallySettlePreservedValue(c)]));
  await check(c.providerPaymentReference,"C concurrent duplicate");
  console.log("PASS C: concurrent identical event");

  // D is NOT silently approximated: it requires physical reversal receipt + checkout
  // revocation + fault injection before credit settlement, then signed ingress replay.
  // Keep that separate cross-ledger court pending real authority composition.
  console.log("NOT RUN D: physical reversal-receipt-to-credit crash recovery requires cross-ledger harness");
} finally {
  checkpoint("CLEANUP START");
  await bounded("mongoose disconnect",()=>mongoose.disconnect());
  clearTimeout(hardWatchdog);
  checkpoint("CLEANUP DONE");
}
