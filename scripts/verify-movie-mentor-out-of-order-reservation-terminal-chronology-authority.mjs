import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor out-of-order reservation terminal chronology authority court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const spend=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");

assert.match(spend,/entitlementRevision:entitlement\.entitlementRevision,status:"reserved"/,"each reservation must capture the entitlement revision created by its own reserve transaction");
const guards=[...source.matchAll(/entitlementRevision:\{\$gte:reservation\.entitlementRevision\},reservedUnits:\{\$gte:reservation\.units\}/g)];
assert.ok(guards.length>=3,"terminal dispositions must accept current entitlement chronology at or after their reservation revision while requiring enough reserved value");
const terminal=[...source.matchAll(/findOneAndUpdate\(\{reservationId:[^}]+status:"reserved"\}/g)];
assert.ok(terminal.length>=3,"terminal disposition must still CAS the exact reservation identity");

function dispose(state,id,fate){
 const r=state.reservations[id];
 if(!r||r.status!=="reserved") return false;
 if(state.revision<r.entitlementRevision||state.reserved<r.units) throw new Error("ledger-conflict");
 state.reserved-=r.units;
 if(fate==="consumed")state.consumed+=r.units;else state.remaining+=r.units;
 state.revision+=1;r.status=fate;return true;
}

const state={revision:12,reserved:2,remaining:8,consumed:0,reservations:{older:{units:1,entitlementRevision:11,status:"reserved"},newer:{units:1,entitlementRevision:12,status:"reserved"}}};
assert.equal(dispose(state,"newer","consumed"),true,"newer reservation may terminate first");
assert.equal(dispose(state,"older","released"),true,"older reservation must remain terminable after later reservation chronology advanced the aggregate revision");
assert.deepEqual({revision:state.revision,reserved:state.reserved,remaining:state.remaining,consumed:state.consumed,older:state.reservations.older.status,newer:state.reservations.newer.status},{revision:14,reserved:0,remaining:9,consumed:1,older:"released",newer:"consumed"});

const reverse={revision:12,reserved:2,remaining:8,consumed:0,reservations:{older:{units:1,entitlementRevision:11,status:"reserved"},newer:{units:1,entitlementRevision:12,status:"reserved"}}};
assert.equal(dispose(reverse,"older","released"),true);
assert.equal(dispose(reverse,"newer","consumed"),true);
assert.deepEqual({revision:reverse.revision,reserved:reverse.reserved,remaining:reverse.remaining,consumed:reverse.consumed},{revision:14,reserved:0,remaining:9,consumed:1});

console.log("GREEN: reservation terminal authority survives legitimate later entitlement revisions and remains exact-reservation owned in either disposition order.");
console.log("LAW: ENTITLEMENT REVISION ORDERS LEDGER HISTORY; IT MUST NOT TURN A STILL-RESERVED OLDER RESERVATION INTO AN ORPHAN OR LET IT BORROW ANOTHER RESERVATION'S TERMINAL IDENTITY.");
