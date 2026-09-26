import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Movie Mentor exact reservation ↔ aggregate reserved balance terminal ownership court");

const source=fs.readFileSync(new URL("../ai/MovieMentorInferenceSettlementMongoStore.js",import.meta.url),"utf8");
const spend=fs.readFileSync(new URL("../ai/MovieMentorInferenceSpendMongoStore.js",import.meta.url),"utf8");

assert.match(spend,/reservationSchema\.index\(\{reservationId:1\},\{unique:true\}\)/,"reservation identity must be physically unique by reservationId");
assert.match(spend,/entitlementSchema\.index\(\{principalId:1\},\{unique:true\}\)/,"aggregate entitlement must be physically singleton by principal");
assert.match(spend,/\$inc:\{remainingUnits:-n\.units,reservedUnits:n\.units,entitlementRevision:1\}/,"reservation mint must atomically move units into the principal aggregate");
assert.match(spend,/Reservation\.create\(\[\{domain:DOMAIN,schema:SCHEMA,\.\.\.n,entitlementRevision:entitlement\.entitlementRevision,status:"reserved"/,"reservation row must be minted in the same transaction as aggregate reservation");

const terminalMutations=[...source.matchAll(/findOneAndUpdate\(\{reservationId:[^}]+status:"reserved"\},\{\$set:\{status:"(consumed|released)"/g)];
assert.ok(terminalMutations.length>=3,"all settlement dispositions must CAS an exact reserved reservation identity");

const aggregateDebits=[...source.matchAll(/reservedUnits:\{\$gte:reservation\.units\}\},\{\$inc:\{reservedUnits:-reservation\.units,(remainingUnits|consumedUnits):reservation\.units,entitlementRevision:1\}/g)];
assert.ok(aggregateDebits.length>=3,"each terminal disposition must move the same reservation units out of aggregate reserved balance in its transaction");

function terminal(state,id,fate){
 const reservation=state.reservations[id];
 if(!reservation||reservation.status!=="reserved") return false;
 if(state.reservedUnits<reservation.units) throw new Error("ledger-conflict");
 state.reservedUnits-=reservation.units;
 if(fate==="consumed") state.consumedUnits+=reservation.units;
 else state.remainingUnits+=reservation.units;
 reservation.status=fate;
 return true;
}
const state={reservedUnits:2,remainingUnits:8,consumedUnits:0,reservations:{A:{units:1,status:"reserved"},B:{units:1,status:"reserved"}}};
assert.equal(terminal(state,"A","released"),true);
assert.equal(terminal(state,"A","consumed"),false,"reservation A cannot terminally spend aggregate value twice even while B leaves aggregate reservedUnits available");
assert.equal(state.reservedUnits,1,"B's reserved aggregate unit must remain after A terminates");
assert.equal(state.reservations.B.status,"reserved");
assert.equal(terminal(state,"B","consumed"),true);
assert.deepEqual({reservedUnits:state.reservedUnits,remainingUnits:state.remainingUnits,consumedUnits:state.consumedUnits,A:state.reservations.A.status,B:state.reservations.B.status},{reservedUnits:0,remainingUnits:9,consumedUnits:1,A:"released",B:"consumed"});

console.log("GREEN: aggregate reservedUnits cannot by itself authorize a second terminal disposition for an already-settled reservation.");
console.log("LAW: AGGREGATE RESERVED VALUE IS FUNGIBLE ACCOUNTING; EXACT RESERVATION STATUS OWNS EACH TERMINAL ECONOMIC DISPOSITION.");
